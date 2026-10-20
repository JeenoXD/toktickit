import type { RequesterDashboardData, StaffDashboardData } from "../../src/api";

const now = "2026-10-20T05:00:00.000Z";

export function staffDashboard(overrides: Partial<StaffDashboardData> = {}): StaffDashboardData {
  return {
    metrics: {
      unassigned: { count: 4, drillDown: { view: "ticketQueue", filters: { statusGroup: "active", owner: "unassigned" } } },
      myAssigned: { count: 3, drillDown: { view: "ticketQueue", filters: { statusGroup: "active", owner: "me" } } },
      waitingForRequester: { count: 0, drillDown: { view: "ticketQueue", filters: { status: "WAITING_FOR_REQUESTER" } } },
      appearsResolved: { count: 1, drillDown: { view: "ticketQueue", filters: { statusGroup: "active", appearsResolved: "true" } } },
      myPlannedActions: {
        count: 1,
        items: [{ actionId: 9, ticketId: 2, ticketNumber: "TKT-2026-000002", description: "Disable add-ins", actionAt: now, followUpNote: null }],
      },
      myFollowUps: { count: 0, items: [] },
    },
    byStatus: { NEW: 2, OPEN: 3, IN_PROGRESS: 2, WAITING_FOR_REQUESTER: 0, RESOLVED: 2, CLOSED: 1, REOPENED: 1, CANCELLED: 1 },
    byItPriority: { HIGH: 2, MEDIUM: 4, LOW: 1, UNSET: 1 },
    urgent: [{ id: 5, ticketNumber: "TKT-2026-000005", summary: "Grade app is blank", currentStatus: "OPEN", itPriority: "HIGH", updatedAt: now, owner: null }],
    recentlyUpdated: [
      { id: 3, ticketNumber: "TKT-2026-000003", summary: "VPN drops", currentStatus: "IN_PROGRESS", itPriority: "HIGH", updatedAt: now, owner: { id: 7, name: "Carlos Mendez" } },
    ],
    generatedAt: now,
    ...overrides,
  };
}

export function requesterDashboard(overrides: Partial<RequesterDashboardData> = {}): RequesterDashboardData {
  return {
    metrics: {
      openTickets: { count: 3, drillDown: { view: "myTickets", filters: { statusGroup: "active" } } },
      waitingForMe: { count: 1, drillDown: { view: "myTickets", filters: { status: "WAITING_FOR_REQUESTER" } } },
      resolved: { count: 2, drillDown: { view: "myTickets", filters: { status: "RESOLVED" } } },
      closed: { count: 0, drillDown: { view: "myTickets", filters: { status: "CLOSED" } } },
    },
    recentlyUpdated: [{ id: 1, ticketNumber: "TKT-2026-000001", summary: "Laptop battery drains", currentStatus: "OPEN", itPriority: "MEDIUM", updatedAt: now }],
    recentlyResolved: [
      { id: 4, ticketNumber: "TKT-2026-000004", summary: "Docking station not detected", currentStatus: "RESOLVED", itPriority: "MEDIUM", updatedAt: now, resolvedAt: now },
    ],
    generatedAt: now,
    ...overrides,
  };
}
