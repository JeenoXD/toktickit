// UNIT-02: Action validation rules (BR-05 to BR-10, BR-21).
import { describe, it, expect } from "vitest";
import {
  validateAction,
  canTransitionAction,
  isTicketLocked,
  parseClientRequestId,
  parseVersion,
  ExistingAction,
} from "../../src/actionRules.js";

const ticketCreatedAt = new Date("2026-10-01T00:00:00.000Z");
const now = new Date("2026-10-10T00:00:00.000Z");
const base: ExistingAction = {
  description: "",
  actionAt: now,
  result: null,
  performedById: 7,
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
};
const planned = { ticketCreatedAt, targetStatus: "PLANNED" as const, now };

describe("validateAction", () => {
  it("trims text and keeps defaults", () => {
    const r = validateAction({ description: "  Replaced cable  ", attachmentNotes: "  see photo.png " }, base, planned);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.description).toBe("Replaced cable");
      expect(r.value.attachmentNotes).toBe("see photo.png");
      expect(r.value.performedById).toBe(7);
    }
  });

  it("requires a non-blank description (BR-06)", () => {
    const r = validateAction({ description: "   " }, base, planned);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.description).toBeTruthy();
  });

  it("rejects over-length fields", () => {
    const r = validateAction(
      { description: "x".repeat(2001), result: "y".repeat(2001), attachmentNotes: "z".repeat(501) },
      base,
      planned,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["attachmentNotes", "description", "result"]);
  });

  it("requires a result to complete (BR-06)", () => {
    const r = validateAction({ description: "Work" }, base, { ...planned, targetStatus: "COMPLETED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.result).toMatch(/required/i);
  });

  it("requires a follow-up note when follow-up is needed and clears it otherwise (BR-07)", () => {
    const missing = validateAction({ description: "Work", followUpRequired: true, followUpNote: " " }, base, planned);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fields.followUpNote).toBeTruthy();

    const cleared = validateAction({ description: "Work", followUpRequired: false, followUpNote: "ignored" }, base, planned);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.value.followUpNote).toBeNull();
  });

  it("rejects dates before the ticket and future completed actions, but allows future planned ones (BR-09)", () => {
    const before = validateAction({ description: "Work", actionAt: "2026-09-30T23:59:00.000Z" }, base, planned);
    expect(before.ok).toBe(false);

    // Same minute as ticket creation is accepted (UI time inputs have minute precision).
    const sameMinute = validateAction(
      { description: "Work", actionAt: "2026-10-01T00:00:00.000Z" },
      base,
      { ...planned, ticketCreatedAt: new Date("2026-10-01T00:00:45.000Z") },
    );
    expect(sameMinute.ok).toBe(true);

    const futurePlanned = validateAction({ description: "Work", actionAt: "2026-10-20T00:00:00.000Z" }, base, planned);
    expect(futurePlanned.ok).toBe(true);

    const futureCompleted = validateAction(
      { description: "Work", result: "Done", actionAt: "2026-10-10T00:10:00.000Z" },
      base,
      { ...planned, targetStatus: "COMPLETED" },
    );
    expect(futureCompleted.ok).toBe(false);

    const withinTolerance = validateAction(
      { description: "Work", result: "Done", actionAt: "2026-10-10T00:04:00.000Z" },
      base,
      { ...planned, targetStatus: "COMPLETED" },
    );
    expect(withinTolerance.ok).toBe(true);
  });

  it("rejects invalid dates and performer ids", () => {
    const r = validateAction({ description: "Work", actionAt: "not a date", performedById: "abc" }, base, planned);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["actionAt", "performedById"]);
  });
});

describe("action status and helpers", () => {
  it("only allows Planned to Completed or Cancelled (BR-05)", () => {
    expect(canTransitionAction("PLANNED", "COMPLETED")).toBe(true);
    expect(canTransitionAction("PLANNED", "CANCELLED")).toBe(true);
    expect(canTransitionAction("PLANNED", "PLANNED")).toBe(false);
    expect(canTransitionAction("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionAction("CANCELLED", "COMPLETED")).toBe(false);
  });

  it("locks Closed and Cancelled tickets only (BR-10)", () => {
    expect(isTicketLocked("CLOSED")).toBe(true);
    expect(isTicketLocked("CANCELLED")).toBe(true);
    expect(isTicketLocked("RESOLVED")).toBe(false);
    expect(isTicketLocked("IN_PROGRESS")).toBe(false);
  });

  it("parses clientRequestId and version", () => {
    expect(parseClientRequestId(undefined)).toEqual({ ok: true, value: null });
    expect(parseClientRequestId(" abc ")).toEqual({ ok: true, value: "abc" });
    expect(parseClientRequestId(123).ok).toBe(false);
    expect(parseClientRequestId("x".repeat(101)).ok).toBe(false);
    expect(parseVersion(3)).toBe(3);
    expect(parseVersion("2")).toBe(2);
    expect(parseVersion(undefined)).toBeNull();
    expect(parseVersion(0)).toBeNull();
  });
});
