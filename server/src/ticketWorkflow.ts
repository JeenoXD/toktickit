// Lab 4 Ticket workflow rules (docs/lab-04/specification.md BR-14 to BR-17).
// Pure functions so the full matrix can be unit tested without the database.

export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

interface TransitionRule {
  to: TicketStatusValue;
  adminOnly?: boolean;
}

/** BR-14: the final transition matrix. "Staff" = IT Staff or Administrator. */
export const TRANSITIONS: Record<TicketStatusValue, TransitionRule[]> = {
  NEW: [{ to: "OPEN" }, { to: "CANCELLED" }],
  OPEN: [{ to: "IN_PROGRESS" }, { to: "WAITING_FOR_REQUESTER" }, { to: "CANCELLED" }],
  IN_PROGRESS: [{ to: "OPEN" }, { to: "WAITING_FOR_REQUESTER" }, { to: "RESOLVED" }],
  WAITING_FOR_REQUESTER: [{ to: "IN_PROGRESS" }, { to: "RESOLVED" }],
  RESOLVED: [{ to: "CLOSED" }, { to: "REOPENED" }],
  CLOSED: [{ to: "REOPENED" }],
  REOPENED: [{ to: "OPEN" }, { to: "IN_PROGRESS" }],
  CANCELLED: [{ to: "REOPENED", adminOnly: true }],
};

/** Statuses a Requester's "appears resolved" flag is not allowed in (BR-19). */
export const APPEARS_RESOLVED_BLOCKED: TicketStatusValue[] = ["RESOLVED", "CLOSED", "CANCELLED"];

export type BlockReason = "NO_OWNER" | "NO_COMPLETED_ACTION" | "PLANNED_ACTIONS_OPEN";

export interface WorkflowContext {
  hasOwner: boolean;
  completedActions: number;
  plannedActions: number;
}

export function isTicketStatus(value: unknown): value is TicketStatusValue {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isStaffRole(role?: string): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

/** Conditions that block a transition that is otherwise in the matrix (BR-15 to BR-17). */
export function blockReasons(to: TicketStatusValue, ctx: WorkflowContext): BlockReason[] {
  const reasons: BlockReason[] = [];
  if (to === "RESOLVED") {
    if (!ctx.hasOwner) reasons.push("NO_OWNER");
    if (ctx.completedActions < 1) reasons.push("NO_COMPLETED_ACTION");
    if (ctx.plannedActions > 0) reasons.push("PLANNED_ACTIONS_OPEN");
  } else if (to === "IN_PROGRESS") {
    if (!ctx.hasOwner) reasons.push("NO_OWNER");
  } else if (to === "CANCELLED") {
    if (ctx.plannedActions > 0) reasons.push("PLANNED_ACTIONS_OPEN");
  }
  return reasons;
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; httpStatus: 400 | 403 | 409; error: string; message: string; reasons?: BlockReason[] };

export function checkTransition(
  from: TicketStatusValue,
  to: unknown,
  role: string | undefined,
  ctx: WorkflowContext,
): TransitionCheck {
  if (!isStaffRole(role)) {
    return { ok: false, httpStatus: 403, error: "FORBIDDEN", message: "Only IT Staff or Administrators can change ticket status." };
  }
  if (!isTicketStatus(to)) {
    return { ok: false, httpStatus: 400, error: "INVALID_STATUS", message: "Invalid status value." };
  }
  const rule = TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) {
    return { ok: false, httpStatus: 400, error: "INVALID_STATUS_TRANSITION", message: `Status cannot change from ${from} to ${to}.` };
  }
  if (rule.adminOnly && role !== "ADMINISTRATOR") {
    return { ok: false, httpStatus: 403, error: "FORBIDDEN", message: "Only an Administrator can reopen a cancelled ticket." };
  }
  const reasons = blockReasons(to, ctx);
  if (reasons.length === 0) return { ok: true };

  if (to === "IN_PROGRESS") {
    return { ok: false, httpStatus: 400, error: "OWNER_REQUIRED", message: "Assign an owner before moving the ticket to In Progress.", reasons };
  }
  if (to === "CANCELLED") {
    return {
      ok: false,
      httpStatus: 409,
      error: "PLANNED_ACTIONS_OPEN",
      message: "Complete or cancel the planned actions before cancelling the ticket.",
      reasons,
    };
  }
  return {
    ok: false,
    httpStatus: 409,
    error: "RESOLUTION_GATE_FAILED",
    message: "This ticket cannot be resolved yet.",
    reasons,
  };
}

/** Options for the status control: every permitted next status, with anything currently blocking it. */
export function allowedTransitions(from: TicketStatusValue, role: string | undefined, ctx: WorkflowContext) {
  if (!isStaffRole(role)) return [];
  return TRANSITIONS[from]
    .filter((r) => !r.adminOnly || role === "ADMINISTRATOR")
    .map((r) => ({ status: r.to, blockedBy: blockReasons(r.to, ctx) }));
}

/** Field changes that go with a status change (BR-19, resolvedAt). */
export function statusSideEffects(to: TicketStatusValue, now: Date) {
  const data: { resolvedAt?: Date | null; requesterResolvedAt?: null } = {};
  if (to === "RESOLVED") {
    data.resolvedAt = now;
    data.requesterResolvedAt = null;
  } else if (to === "REOPENED") {
    data.resolvedAt = null;
    data.requesterResolvedAt = null;
  } else if (to === "OPEN") {
    data.requesterResolvedAt = null;
  }
  return data;
}
