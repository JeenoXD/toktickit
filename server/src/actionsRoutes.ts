// Lab 4 Actions Taken API (docs/lab-04/api-spec.md Section 2).
import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { authMiddleware, AuthRequest } from "./authMiddleware.js";
import {
  validateAction,
  canTransitionAction,
  isTicketLocked,
  parseClientRequestId,
  parseVersion,
  ActionStatusValue,
} from "./actionRules.js";

// authMiddleware is attached per route so this router never intercepts other /api paths.
const router = Router();

const actionInclude = {
  performedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

function isStaff(role?: string): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function forbidden(res: Response) {
  return res.status(403).json({ error: "FORBIDDEN", message: "Only IT Staff or Administrators can change Actions Taken." });
}

function notFound(res: Response, what = "Ticket") {
  return res.status(404).json({ error: "NOT_FOUND", message: `${what} not found.` });
}

function locked(res: Response) {
  return res.status(409).json({ error: "TICKET_LOCKED", message: "This ticket is closed or cancelled; its actions are read only." });
}

function validationError(res: Response, fields: Record<string, string>) {
  return res.status(400).json({ error: "VALIDATION_ERROR", message: "Please correct the highlighted fields.", fields });
}

/** BR-03: performer must be an active IT Staff or Administrator. */
async function checkPerformer(userId: number): Promise<string | null> {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!user || !isStaff(user.role)) return "Performed by must be an IT Staff member or Administrator.";
  if (!user.isActive) return "Performed by must be an active user.";
  return null;
}

// GET /api/staff-users: active IT Staff and Administrators for pickers.
router.get("/staff-users", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaff(req.user?.role)) return forbidden(res);
  try {
    const users = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    res.status(200).json({ data: users });
  } catch (err) {
    console.error("GET /api/staff-users", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to load staff users." });
  }
});

// GET /api/tickets/:id/actions
router.get("/tickets/:id/actions", authMiddleware, async (req: AuthRequest, res: Response) => {
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { requesterId: true } });
    if (!ticket) return notFound(res);
    // Requesters may read actions only on their own tickets (FR-04); existence is not revealed.
    if (!isStaff(req.user?.role) && ticket.requesterId !== req.user?.id) return notFound(res);

    const actions = await prisma.actionTaken.findMany({
      where: { ticketId },
      include: actionInclude,
      orderBy: [{ actionAt: "asc" }, { id: "asc" }], // BR-12
    });
    res.status(200).json({ data: actions });
  } catch (err) {
    console.error("GET /api/tickets/:id/actions", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to load actions." });
  }
});

// POST /api/tickets/:id/actions
router.post("/tickets/:id/actions", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaff(req.user?.role)) return forbidden(res);
  const userId = req.user!.id;
  const ticketId = parseId(req.params.id);
  if (!ticketId) return notFound(res);

  const body = req.body ?? {};
  const clientRequestId = parseClientRequestId(body.clientRequestId);
  if (!clientRequestId.ok) return validationError(res, { clientRequestId: "clientRequestId must be 1 to 100 characters." });

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, createdAt: true, currentStatus: true },
    });
    if (!ticket) return notFound(res);

    // BR-21: a retried request returns the action that was already created.
    if (clientRequestId.value) {
      const existing = await prisma.actionTaken.findUnique({
        where: { ticketId_clientRequestId: { ticketId, clientRequestId: clientRequestId.value } },
        include: actionInclude,
      });
      if (existing) return res.status(200).json(existing);
    }

    if (isTicketLocked(ticket.currentStatus)) return locked(res);

    const validation = validateAction(
      body,
      {
        description: "",
        actionAt: new Date(),
        result: null,
        performedById: userId, // BR-03: defaults to the authenticated user
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
      },
      { ticketCreatedAt: ticket.createdAt, targetStatus: "PLANNED" },
    );
    if (!validation.ok) return validationError(res, validation.fields);

    const performerError = await checkPerformer(validation.value.performedById);
    if (performerError) return validationError(res, { performedById: performerError });

    try {
      const created = await prisma.actionTaken.create({
        data: {
          ...validation.value,
          ticketId,
          createdById: userId, // BR-04: never taken from the client
          status: "PLANNED",
          clientRequestId: clientRequestId.value,
        },
        include: actionInclude,
      });
      await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return res.status(201).json(created);
    } catch (err) {
      // Two identical retries raced past the lookup: return the winner.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && clientRequestId.value) {
        const existing = await prisma.actionTaken.findUnique({
          where: { ticketId_clientRequestId: { ticketId, clientRequestId: clientRequestId.value } },
          include: actionInclude,
        });
        if (existing) return res.status(200).json(existing);
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/tickets/:id/actions", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to save the action." });
  }
});

async function loadForWrite(ticketIdRaw: unknown, actionIdRaw: unknown) {
  const ticketId = parseId(ticketIdRaw);
  const actionId = parseId(actionIdRaw);
  if (!ticketId || !actionId) return null;
  const action = await getPrisma().actionTaken.findUnique({
    where: { id: actionId },
    include: { ticket: { select: { createdAt: true, currentStatus: true } } },
  });
  if (!action || action.ticketId !== ticketId) return null;
  return action;
}

async function conflict(res: Response, actionId: number) {
  const current = await getPrisma().actionTaken.findUnique({ where: { id: actionId }, include: actionInclude });
  return res.status(409).json({
    error: "STALE_UPDATE",
    message: "This action was changed by someone else. Reload to see the latest version.",
    current,
  });
}

// PATCH /api/tickets/:id/actions/:actionId  (edit a Planned action)
router.patch("/tickets/:id/actions/:actionId", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaff(req.user?.role)) return forbidden(res);
  const body = req.body ?? {};
  const version = parseVersion(body.version);
  if (!version) return validationError(res, { version: "version is required." });

  try {
    const prisma = getPrisma();
    const action = await loadForWrite(req.params.id, req.params.actionId);
    if (!action) return notFound(res, "Action");
    if (isTicketLocked(action.ticket.currentStatus)) return locked(res);
    if (action.version !== version) return conflict(res, action.id);
    if (action.status !== "PLANNED") {
      return res.status(400).json({ error: "ACTION_NOT_EDITABLE", message: "Completed or cancelled actions are read only." });
    }

    const validation = validateAction(body, action, {
      ticketCreatedAt: action.ticket.createdAt,
      targetStatus: "PLANNED",
    });
    if (!validation.ok) return validationError(res, validation.fields);

    if (validation.value.performedById !== action.performedById) {
      const performerError = await checkPerformer(validation.value.performedById);
      if (performerError) return validationError(res, { performedById: performerError });
    }

    // Atomic compare-and-set on version (BR-20).
    const updated = await prisma.actionTaken.updateMany({
      where: { id: action.id, version, status: "PLANNED" },
      data: { ...validation.value, version: { increment: 1 } },
    });
    if (updated.count === 0) return conflict(res, action.id);

    await prisma.ticket.update({ where: { id: action.ticketId }, data: { updatedAt: new Date() } });
    const fresh = await prisma.actionTaken.findUnique({ where: { id: action.id }, include: actionInclude });
    res.status(200).json(fresh);
  } catch (err) {
    console.error("PATCH /api/tickets/:id/actions/:actionId", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to update the action." });
  }
});

// PATCH /api/tickets/:id/actions/:actionId/status  (complete or cancel)
router.patch("/tickets/:id/actions/:actionId/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!isStaff(req.user?.role)) return forbidden(res);
  const body = req.body ?? {};
  const version = parseVersion(body.version);
  if (!version) return validationError(res, { version: "version is required." });

  try {
    const prisma = getPrisma();
    const action = await loadForWrite(req.params.id, req.params.actionId);
    if (!action) return notFound(res, "Action");
    if (isTicketLocked(action.ticket.currentStatus)) return locked(res);
    if (action.version !== version) return conflict(res, action.id);
    if (!canTransitionAction(action.status as ActionStatusValue, body.status)) {
      return res.status(400).json({
        error: "INVALID_ACTION_TRANSITION",
        message: `An action cannot change from ${action.status} to ${String(body.status)}.`,
      });
    }

    const target = body.status as "COMPLETED" | "CANCELLED";
    const now = new Date();
    let data: Prisma.ActionTakenUpdateManyMutationInput;
    if (target === "COMPLETED") {
      const validation = validateAction({ result: body.result }, action, {
        ticketCreatedAt: action.ticket.createdAt,
        targetStatus: "COMPLETED",
        now,
      });
      if (!validation.ok) return validationError(res, validation.fields);
      data = { status: "COMPLETED", result: validation.value.result, completedAt: now };
    } else {
      data = { status: "CANCELLED", cancelledAt: now };
    }

    const updated = await prisma.actionTaken.updateMany({
      where: { id: action.id, version, status: "PLANNED" },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) return conflict(res, action.id);

    await prisma.ticket.update({ where: { id: action.ticketId }, data: { updatedAt: now } });
    const fresh = await prisma.actionTaken.findUnique({ where: { id: action.id }, include: actionInclude });
    res.status(200).json(fresh);
  } catch (err) {
    console.error("PATCH /api/tickets/:id/actions/:actionId/status", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unable to update the action status." });
  }
});

export default router;
