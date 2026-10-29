// Lab 4 Ticket workflow API (docs/lab-04/api-spec.md Section 3).
// Replaces the Lab 3 claim / reassign / priority / status / requester-resolved handlers.
import { Router, Response } from "express";
import { getPrisma } from "./prisma.js";
import { authMiddleware, AuthRequest } from "./authMiddleware.js";
import { parseVersion } from "./actionRules.js";
import {
  allowedTransitions,
  checkTransition,
  isStaffRole,
  statusSideEffects,
  APPEARS_RESOLVED_BLOCKED,
  TicketStatusValue,
  WorkflowContext,
} from "./ticketWorkflow.js";

const router = Router();

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function notFound(res: Response) {
  return res.status(404).json({ error: "NOT_FOUND", message: "Ticket not found." });
}

function forbidden(res: Response, message = "Only IT Staff or Administrators can change ticket workflow.") {
  return res.status(403).json({ error: "FORBIDDEN", message });
}

function missingVersion(res: Response) {
  return res.status(400).json({ error: "VALIDATION_ERROR", message: "version is required.", fields: { version: "version is required." } });
}

async function workflowContext(ticketId: number, ownerId: number | null): Promise<WorkflowContext> {
  const prisma = getPrisma();
  const [completedActions, plannedActions] = await Promise.all([
    prisma.actionTaken.count({ where: { ticketId, status: "COMPLETED" } }),
    prisma.actionTaken.count({ where: { ticketId, status: "PLANNED" } }),
  ]);
  return { hasOwner: ownerId !== null, completedActions, plannedActions };
}

const ownerSelect = { select: { id: true, name: true } } as const;

async function ticketResponse(ticketId: number, role?: string) {
  const ticket = await getPrisma().ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { owner: ownerSelect },
  });
  const ctx = await workflowContext(ticketId, ticket.ownerId);
  return { ...ticket, allowedTransitions: allowedTransitions(ticket.currentStatus as TicketStatusValue, role, ctx) };
}

async function staleResponse(res: Response, ticketId: number, role?: string) {
  return res.status(409).json({
    error: "STALE_UPDATE",
    message: "This ticket was changed by someone else. Reload to see the latest version.",
    current: await ticketResponse(ticketId, role),
  });
}

/**
 * Compare-and-set on Ticket.version (BR-20). Returns false when someone else
 * changed the ticket first; nothing is written in that case.
 */
async function updateWithVersion(ticketId: number, version: number, data: Record<string, unknown>): Promise<boolean> {
  const result = await getPrisma().ticket.updateMany({
    where: { id: ticketId, version },
    data: { ...data, version: { increment: 1 } },
  });
  return result.count === 1;
}

// GET /api/tickets/:id/allowed-transitions
router.get("/tickets/:id/allowed-transitions", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaffRole(req.user?.role)) return forbidden(res, "Only IT Staff or Administrators can view status options.");
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound(res);
    const ctx = await workflowContext(ticketId, ticket.ownerId);
    res.status(200).json({
      currentStatus: ticket.currentStatus,
      version: ticket.version,
      allowed: allowedTransitions(ticket.currentStatus as TicketStatusValue, req.user?.role, ctx),
    });
  } catch (err) {
    console.error("GET /api/tickets/:id/allowed-transitions", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to load status options." });
  }
});

// GET /api/tickets/:id/status-history (append-only; there is no write endpoint, BR-18)
router.get("/tickets/:id/status-history", authMiddleware, async (req: AuthRequest, res: Response) => {
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { requesterId: true } });
    if (!ticket) return notFound(res);
    if (!isStaffRole(req.user?.role) && ticket.requesterId !== req.user?.id) return notFound(res);
    const history = await prisma.ticketStatusHistory.findMany({
      where: { ticketId },
      include: { changedBy: { select: { id: true, name: true } } },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    });
    res.status(200).json({ data: history });
  } catch (err) {
    console.error("GET /api/tickets/:id/status-history", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to load status history." });
  }
});

// PATCH /api/tickets/:id/status
router.patch("/tickets/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaffRole(req.user?.role)) return forbidden(res, "Only IT Staff or Administrators can update ticket status.");
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  const version = parseVersion(req.body?.version);
  if (!version) return missingVersion(res);
  const nextStatus = req.body?.status;

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound(res);
    if (ticket.version !== version) return staleResponse(res, ticketId, req.user?.role);

    const ctx = await workflowContext(ticketId, ticket.ownerId);
    const check = checkTransition(ticket.currentStatus as TicketStatusValue, nextStatus, req.user?.role, ctx);
    if (!check.ok) {
      return res.status(check.httpStatus).json({ error: check.error, message: check.message, reasons: check.reasons });
    }

    const now = new Date();
    const to = nextStatus as TicketStatusValue;
    // Status change and its history row are written together or not at all.
    const applied = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: { id: ticketId, version, currentStatus: ticket.currentStatus },
        data: { currentStatus: to, ...statusSideEffects(to, now), version: { increment: 1 } },
      });
      if (result.count !== 1) return false;
      await tx.ticketStatusHistory.create({
        data: { ticketId, fromStatus: ticket.currentStatus, toStatus: to, changedById: req.user!.id, changedAt: now },
      });
      return true;
    });
    if (!applied) return staleResponse(res, ticketId, req.user?.role);

    res.status(200).json(await ticketResponse(ticketId, req.user?.role));
  } catch (err) {
    console.error("PATCH /api/tickets/:id/status", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to update ticket status." });
  }
});

// PATCH /api/tickets/:id/claim
router.patch("/tickets/:id/claim", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaffRole(req.user?.role)) return forbidden(res, "Only IT Staff or Administrators can claim tickets.");
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  const version = parseVersion(req.body?.version);
  if (!version) return missingVersion(res);
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound(res);
    if (!(await updateWithVersion(ticketId, version, { ownerId: req.user!.id }))) {
      return staleResponse(res, ticketId, req.user?.role);
    }
    res.status(200).json(await ticketResponse(ticketId, req.user?.role));
  } catch (err) {
    console.error("PATCH /api/tickets/:id/claim", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to claim ticket." });
  }
});

// PATCH /api/tickets/:id/reassign
router.patch("/tickets/:id/reassign", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaffRole(req.user?.role)) return forbidden(res, "Only IT Staff or Administrators can reassign tickets.");
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  const version = parseVersion(req.body?.version);
  if (!version) return missingVersion(res);
  const ownerId = parseId(req.body?.ownerId);
  if (!ownerId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "ownerId must be a positive integer.", fields: { ownerId: "Choose an owner." } });
  }
  try {
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
    if (!target || !isStaffRole(target.role) || !target.isActive) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "The new owner must be an active IT Staff member or Administrator.",
        fields: { ownerId: "The new owner must be an active IT Staff member or Administrator." },
      });
    }
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound(res);
    if (!(await updateWithVersion(ticketId, version, { ownerId }))) {
      return staleResponse(res, ticketId, req.user?.role);
    }
    res.status(200).json(await ticketResponse(ticketId, req.user?.role));
  } catch (err) {
    console.error("PATCH /api/tickets/:id/reassign", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to reassign ticket." });
  }
});

// PATCH /api/tickets/:id/priority
router.patch("/tickets/:id/priority", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaffRole(req.user?.role)) return forbidden(res, "Only IT Staff or Administrators can update IT priority.");
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  const version = parseVersion(req.body?.version);
  if (!version) return missingVersion(res);
  const itPriority = req.body?.itPriority;
  if (!(PRIORITIES as readonly string[]).includes(itPriority)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "itPriority must be LOW, MEDIUM, or HIGH.", fields: { itPriority: "Choose Low, Medium, or High." } });
  }
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return notFound(res);
    if (!(await updateWithVersion(ticketId, version, { itPriority }))) {
      return staleResponse(res, ticketId, req.user?.role);
    }
    res.status(200).json(await ticketResponse(ticketId, req.user?.role));
  } catch (err) {
    console.error("PATCH /api/tickets/:id/priority", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to update priority." });
  }
});

// PATCH /api/tickets/:id/requester-resolved (advisory only, BR-19)
router.patch("/tickets/:id/requester-resolved", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "REQUESTER") {
    return forbidden(res, "Only the ticket's requester can mark it as appearing resolved.");
  }
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.requesterId !== req.user.id) return notFound(res);
    if (APPEARS_RESOLVED_BLOCKED.includes(ticket.currentStatus as TicketStatusValue)) {
      return res.status(400).json({
        error: "INVALID_STATUS_TRANSITION",
        message: `Cannot mark as appears resolved while status is ${ticket.currentStatus}.`,
      });
    }
    // Idempotent: a repeat click keeps the first timestamp. Status is never changed.
    const updated = ticket.requesterResolvedAt
      ? ticket
      : await prisma.ticket.update({ where: { id: ticketId }, data: { requesterResolvedAt: new Date() } });
    res.status(200).json(updated);
  } catch (err) {
    console.error("PATCH /api/tickets/:id/requester-resolved", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to update the ticket." });
  }
});

export default router;
