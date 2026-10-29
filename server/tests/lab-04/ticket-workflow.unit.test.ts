// UNIT-01: transition matrix, roles, and resolution gate (BR-14 to BR-17, BR-19).
import { describe, it, expect } from "vitest";
import {
  TICKET_STATUSES,
  TRANSITIONS,
  allowedTransitions,
  blockReasons,
  checkTransition,
  statusSideEffects,
  TicketStatusValue,
} from "../../src/ticketWorkflow.js";

const ready = { hasOwner: true, completedActions: 1, plannedActions: 0 };

// The documented matrix from specification.md BR-14, written out independently of the code.
const EXPECTED: Record<TicketStatusValue, TicketStatusValue[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS"],
  CANCELLED: ["REOPENED"],
};

describe("ticket transition matrix", () => {
  it("matches the specification exactly", () => {
    for (const from of TICKET_STATUSES) {
      expect(TRANSITIONS[from].map((r) => r.to).sort()).toEqual([...EXPECTED[from]].sort());
    }
  });

  it("checks every from/to pair for an Administrator with all conditions met", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        const result = checkTransition(from, to, "ADMINISTRATOR", ready);
        expect(result.ok, `${from} -> ${to}`).toBe(EXPECTED[from].includes(to));
        if (!result.ok) expect(result.error).toBe("INVALID_STATUS_TRANSITION");
      }
    }
  });

  it("rejects Requesters and unknown statuses", () => {
    expect(checkTransition("NEW", "OPEN", "REQUESTER", ready)).toMatchObject({ ok: false, httpStatus: 403 });
    expect(checkTransition("NEW", "DONE", "IT_STAFF", ready)).toMatchObject({ ok: false, error: "INVALID_STATUS" });
  });

  it("only lets an Administrator reopen a cancelled ticket", () => {
    expect(checkTransition("CANCELLED", "REOPENED", "IT_STAFF", ready)).toMatchObject({ ok: false, httpStatus: 403 });
    expect(checkTransition("CANCELLED", "REOPENED", "ADMINISTRATOR", ready).ok).toBe(true);
    expect(allowedTransitions("CANCELLED", "IT_STAFF", ready)).toEqual([]);
    expect(allowedTransitions("CANCELLED", "ADMINISTRATOR", ready)).toEqual([{ status: "REOPENED", blockedBy: [] }]);
  });
});

describe("resolution gate and owner rules", () => {
  it("requires an owner, a completed action, and no planned actions to resolve (BR-15)", () => {
    expect(blockReasons("RESOLVED", { hasOwner: false, completedActions: 0, plannedActions: 2 })).toEqual([
      "NO_OWNER",
      "NO_COMPLETED_ACTION",
      "PLANNED_ACTIONS_OPEN",
    ]);
    const result = checkTransition("IN_PROGRESS", "RESOLVED", "IT_STAFF", { hasOwner: true, completedActions: 0, plannedActions: 0 });
    expect(result).toMatchObject({ ok: false, httpStatus: 409, error: "RESOLUTION_GATE_FAILED", reasons: ["NO_COMPLETED_ACTION"] });
    expect(checkTransition("WAITING_FOR_REQUESTER", "RESOLVED", "IT_STAFF", ready).ok).toBe(true);
  });

  it("requires an owner for In Progress (BR-17)", () => {
    expect(checkTransition("OPEN", "IN_PROGRESS", "IT_STAFF", { ...ready, hasOwner: false })).toMatchObject({
      ok: false,
      httpStatus: 400,
      error: "OWNER_REQUIRED",
    });
  });

  it("blocks cancelling while planned actions exist (BR-16)", () => {
    expect(checkTransition("OPEN", "CANCELLED", "IT_STAFF", { ...ready, plannedActions: 1 })).toMatchObject({
      ok: false,
      httpStatus: 409,
      error: "PLANNED_ACTIONS_OPEN",
    });
  });

  it("lists blocked options with their reasons so the UI can explain them", () => {
    const options = allowedTransitions("IN_PROGRESS", "IT_STAFF", { hasOwner: true, completedActions: 0, plannedActions: 1 });
    expect(options).toEqual([
      { status: "OPEN", blockedBy: [] },
      { status: "WAITING_FOR_REQUESTER", blockedBy: [] },
      { status: "RESOLVED", blockedBy: ["NO_COMPLETED_ACTION", "PLANNED_ACTIONS_OPEN"] },
    ]);
    expect(allowedTransitions("NEW", "REQUESTER", ready)).toEqual([]);
  });
});

describe("status side effects", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  it("sets resolvedAt and clears the requester flag on Resolved", () => {
    expect(statusSideEffects("RESOLVED", now)).toEqual({ resolvedAt: now, requesterResolvedAt: null });
  });
  it("clears the flag on Reopened and Open (BR-19)", () => {
    expect(statusSideEffects("REOPENED", now)).toEqual({ resolvedAt: null, requesterResolvedAt: null });
    expect(statusSideEffects("OPEN", now)).toEqual({ requesterResolvedAt: null });
    expect(statusSideEffects("WAITING_FOR_REQUESTER", now)).toEqual({});
  });
});
