// UNIT-03: Bangkok "recent" window and shared filters.
import { describe, it, expect } from "vitest";
import { recentWindowStart } from "../../src/dashboardRoutes.js";
import { combine, priorityFilter, queueExtrasFilter, statusFilter, ACTIVE_STATUSES } from "../../src/ticketFilters.js";

describe("recentWindowStart", () => {
  it("starts at 00:00 Bangkok time six days before today", () => {
    // 2026-10-20 22:00 in Bangkok = 15:00 UTC. Window starts 2026-10-14 00:00 Bangkok = 2026-10-13 17:00 UTC.
    expect(recentWindowStart(new Date("2026-10-20T15:00:00Z")).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("uses the Bangkok date, not the UTC date, just after Bangkok midnight", () => {
    // 2026-10-21 00:30 Bangkok = 2026-10-20 17:30 UTC; Bangkok "today" is already the 21st.
    expect(recentWindowStart(new Date("2026-10-20T17:30:00Z")).toISOString()).toBe("2026-10-14T17:00:00.000Z");
    // One hour earlier (23:30 Bangkok on the 20th) is still the previous window.
    expect(recentWindowStart(new Date("2026-10-20T16:30:00Z")).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });
});

describe("ticket filters", () => {
  it("parses status lists and the active group", () => {
    expect(statusFilter({ status: "OPEN" })).toEqual({ ok: true, where: { currentStatus: "OPEN" } });
    expect(statusFilter({ status: "OPEN,CLOSED" })).toEqual({ ok: true, where: { currentStatus: { in: ["OPEN", "CLOSED"] } } });
    expect(statusFilter({ statusGroup: "active" })).toEqual({ ok: true, where: { currentStatus: { in: ACTIVE_STATUSES } } });
    expect(statusFilter({ status: "OPEN,CLOSED", statusGroup: "active" })).toEqual({ ok: true, where: { currentStatus: "OPEN" } });
    expect(statusFilter({ status: "DONE" }).ok).toBe(false);
    expect(statusFilter({ statusGroup: "old" }).ok).toBe(false);
  });

  it("supports UNSET priority and owner/appears-resolved drill-downs", () => {
    expect(priorityFilter({ itPriority: "UNSET" })).toEqual({ ok: true, where: { itPriority: null } });
    expect(priorityFilter({ itPriority: "URGENT" }).ok).toBe(false);
    expect(queueExtrasFilter({ owner: "me" }, 7)).toEqual({ ok: true, where: { ownerId: 7 } });
    expect(queueExtrasFilter({ owner: "unassigned", appearsResolved: "true" }, 7)).toEqual({
      ok: true,
      where: { ownerId: null, requesterResolvedAt: { not: null } },
    });
    expect(queueExtrasFilter({ owner: "someone" }, 7).ok).toBe(false);
    expect(combine(statusFilter({ status: "NOPE" }), priorityFilter({})).ok).toBe(false);
  });
});
