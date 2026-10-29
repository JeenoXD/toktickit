// Lab 4 dashboards (docs/lab-04/api-spec.md Section 5, specification.md BR-22 to BR-25).
// Every number is counted by the database at request time; full ticket lists are never returned.
import { Router, Response } from "express";
import { getPrisma } from "./prisma.js";
import { authMiddleware, AuthRequest } from "./authMiddleware.js";
import { ACTIVE_STATUSES } from "./ticketFilters.js";
import { TICKET_STATUSES } from "./ticketWorkflow.js";

const router = Router();

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 5;

/**
 * Start of the "recent" window: 00:00 Asia/Bangkok six days before today,
 * so the window covers today plus the previous six calendar days in Bangkok.
 */
export function recentWindowStart(now: Date): Date {
  const bangkokMidnightToday = Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS;
  return new Date(bangkokMidnightToday - 6 * DAY_MS);
}

const listSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
} as const;

const active = { currentStatus: { in: ACTIVE_STATUSES } };

function metric(count: number, view: "myTickets" | "ticketQueue", filters: Record<string, string>) {
  return { count, drillDown: { view, filters } };
}

// GET /api/dashboard/requester
router.get("/dashboard/requester", authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "REQUESTER") {
    return res.status(403).json({ error: "FORBIDDEN", message: "The requester dashboard is for Requesters only." });
  }
  // Always scoped to the session user; any requesterId in the query is ignored (BR-22).
  const requesterId = req.user.id;
  try {
    const prisma = getPrisma();
    const now = new Date();
    const mine = { requesterId };
    const [openTickets, waitingForMe, resolved, closed, recentlyUpdated, resolvedHistory] = await Promise.all([
      prisma.ticket.count({ where: { ...mine, ...active } }),
      prisma.ticket.count({ where: { ...mine, currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ...mine, currentStatus: "RESOLVED" } }),
      prisma.ticket.count({ where: { ...mine, currentStatus: "CLOSED" } }),
      prisma.ticket.findMany({ where: mine, select: listSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: LIST_LIMIT }),
      prisma.ticketStatusHistory.findMany({
        // Only tickets that are still Resolved or Closed; a reopened ticket is not "recently resolved".
        where: {
          toStatus: "RESOLVED",
          changedAt: { gte: recentWindowStart(now) },
          ticket: { ...mine, currentStatus: { in: ["RESOLVED", "CLOSED"] } },
        },
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
        include: { ticket: { select: listSelect } },
      }),
    ]);

    // Latest move to Resolved per ticket, newest first.
    const seen = new Set<number>();
    const recentlyResolved = [];
    for (const h of resolvedHistory) {
      if (seen.has(h.ticketId)) continue;
      seen.add(h.ticketId);
      recentlyResolved.push({ ...h.ticket, resolvedAt: h.changedAt });
      if (recentlyResolved.length === LIST_LIMIT) break;
    }

    res.status(200).json({
      metrics: {
        openTickets: metric(openTickets, "myTickets", { statusGroup: "active" }),
        waitingForMe: metric(waitingForMe, "myTickets", { status: "WAITING_FOR_REQUESTER" }),
        resolved: metric(resolved, "myTickets", { status: "RESOLVED" }),
        closed: metric(closed, "myTickets", { status: "CLOSED" }),
      },
      recentlyUpdated,
      recentlyResolved,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/dashboard/requester", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Dashboard could not be loaded." });
  }
});

// GET /api/dashboard/staff
router.get("/dashboard/staff", authMiddleware, async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;
  if (role !== "IT_STAFF" && role !== "ADMINISTRATOR") {
    return res.status(403).json({ error: "FORBIDDEN", message: "The staff dashboard is for IT Staff and Administrators." });
  }
  const userId = req.user!.id;
  try {
    const prisma = getPrisma();
    const now = new Date();

    const [
      unassigned,
      myAssigned,
      waitingForRequester,
      appearsResolved,
      myPlannedCount,
      myPlannedItems,
      myFollowUpCount,
      myFollowUpItems,
      statusGroups,
      priorityGroups,
      urgentUnassigned,
      urgentAssigned,
      recentlyUpdated,
    ] = await Promise.all([
      prisma.ticket.count({ where: { ...active, ownerId: null } }),
      prisma.ticket.count({ where: { ...active, ownerId: userId } }),
      prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ...active, requesterResolvedAt: { not: null } } }),
      prisma.actionTaken.count({ where: { performedById: userId, status: "PLANNED" } }),
      prisma.actionTaken.findMany({
        where: { performedById: userId, status: "PLANNED" },
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        take: LIST_LIMIT,
        include: { ticket: { select: { id: true, ticketNumber: true } } },
      }),
      prisma.actionTaken.count({
        where: { performedById: userId, status: "COMPLETED", followUpRequired: true, ticket: active },
      }),
      prisma.actionTaken.findMany({
        where: { performedById: userId, status: "COMPLETED", followUpRequired: true, ticket: active },
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        take: LIST_LIMIT,
        include: { ticket: { select: { id: true, ticketNumber: true } } },
      }),
      prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["itPriority"], where: active, _count: { _all: true } }),
      prisma.ticket.findMany({
        where: { ...active, itPriority: "HIGH", ownerId: null },
        select: listSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: LIST_LIMIT,
      }),
      prisma.ticket.findMany({
        where: { ...active, itPriority: "HIGH", ownerId: { not: null } },
        select: listSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: LIST_LIMIT,
      }),
      prisma.ticket.findMany({ where: active, select: listSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: LIST_LIMIT }),
    ]);

    // Every key is always present, with 0 when empty (BR-25).
    const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const g of statusGroups) byStatus[g.currentStatus] = g._count._all;
    const byItPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, UNSET: 0 };
    for (const g of priorityGroups) byItPriority[g.itPriority ?? "UNSET"] = g._count._all;

    const actionItem = (a: (typeof myPlannedItems)[number]) => ({
      actionId: a.id,
      ticketId: a.ticket.id,
      ticketNumber: a.ticket.ticketNumber,
      description: a.description,
      actionAt: a.actionAt,
      followUpNote: a.followUpNote,
    });

    const body: Record<string, unknown> = {
      metrics: {
        unassigned: metric(unassigned, "ticketQueue", { statusGroup: "active", owner: "unassigned" }),
        myAssigned: metric(myAssigned, "ticketQueue", { statusGroup: "active", owner: "me" }),
        waitingForRequester: metric(waitingForRequester, "ticketQueue", { status: "WAITING_FOR_REQUESTER" }),
        appearsResolved: metric(appearsResolved, "ticketQueue", { statusGroup: "active", appearsResolved: "true" }),
        myPlannedActions: { count: myPlannedCount, items: myPlannedItems.map(actionItem) },
        myFollowUps: { count: myFollowUpCount, items: myFollowUpItems.map(actionItem) },
      },
      byStatus,
      byItPriority,
      urgent: [...urgentUnassigned, ...urgentAssigned].slice(0, LIST_LIMIT),
      recentlyUpdated,
      generatedAt: now.toISOString(),
    };

    // Administrator extra (BR-24).
    if (role === "ADMINISTRATOR") {
      const [activeByRole, inactive] = await Promise.all([
        prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
        prisma.user.count({ where: { isActive: false } }),
      ]);
      const activeCounts: Record<string, number> = { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 0 };
      for (const g of activeByRole) activeCounts[g.role] = g._count._all;
      body.users = { active: activeCounts, inactive };
    }

    res.status(200).json(body);
  } catch (err) {
    console.error("GET /api/dashboard/staff", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Dashboard could not be loaded." });
  }
});

export default router;
