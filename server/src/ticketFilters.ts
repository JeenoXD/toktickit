// Lab 4 shared ticket filters. Dashboards and the lists they drill into use the
// same definitions, so a card's count always equals the list it opens (FR-10).
import { TICKET_STATUSES, TicketStatusValue } from "./ticketWorkflow.js";

/** "Active" statuses used by dashboard metrics (specification.md Section 5.3). */
export const ACTIVE_STATUSES: TicketStatusValue[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

export type FilterResult = { ok: true; where: Record<string, unknown> } | { ok: false; message: string; field: string };

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Builds the status part of a ticket filter.
 * status: one status or a comma-separated list. statusGroup=active: the Active statuses.
 */
export function statusFilter(query: Record<string, unknown>): FilterResult {
  const where: Record<string, unknown> = {};
  const status = str(query.status);
  const group = str(query.statusGroup);

  let statuses: string[] | undefined;
  if (status) {
    statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    const invalid = statuses.find((s) => !(TICKET_STATUSES as readonly string[]).includes(s));
    if (invalid) return { ok: false, field: "status", message: `Unknown status: ${invalid}.` };
  }
  if (group) {
    if (group !== "active") return { ok: false, field: "statusGroup", message: "statusGroup must be 'active'." };
    statuses = statuses ? statuses.filter((s) => (ACTIVE_STATUSES as string[]).includes(s)) : [...ACTIVE_STATUSES];
  }
  if (statuses) where.currentStatus = statuses.length === 1 ? statuses[0] : { in: statuses };
  return { ok: true, where };
}

/** IT Priority filter; "UNSET" matches tickets without an IT Priority. */
export function priorityFilter(query: Record<string, unknown>): FilterResult {
  const value = str(query.itPriority);
  if (!value) return { ok: true, where: {} };
  if (value === "UNSET") return { ok: true, where: { itPriority: null } };
  if (!["LOW", "MEDIUM", "HIGH"].includes(value)) {
    return { ok: false, field: "itPriority", message: "itPriority must be LOW, MEDIUM, HIGH, or UNSET." };
  }
  return { ok: true, where: { itPriority: value } };
}

/** Staff queue extras: owner=me|unassigned and appearsResolved=true. */
export function queueExtrasFilter(query: Record<string, unknown>, currentUserId: number): FilterResult {
  const where: Record<string, unknown> = {};
  const owner = str(query.owner);
  if (owner) {
    if (owner === "me") where.ownerId = currentUserId;
    else if (owner === "unassigned") where.ownerId = null;
    else return { ok: false, field: "owner", message: "owner must be 'me' or 'unassigned'." };
  }
  const appears = str(query.appearsResolved);
  if (appears) {
    if (appears !== "true") return { ok: false, field: "appearsResolved", message: "appearsResolved must be 'true'." };
    where.requesterResolvedAt = { not: null };
  }
  return { ok: true, where };
}

/** Combines filter results; returns the first error. */
export function combine(...parts: FilterResult[]): FilterResult {
  const where: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part.ok) return part;
    Object.assign(where, part.where);
  }
  return { ok: true, where };
}
