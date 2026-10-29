// UI-01, UI-02 in docs/lab-04/tests.md
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffDashboard from "../../src/StaffDashboard";
import * as api from "../../src/api";
import { staffDashboard } from "./dashboardFixtures";

beforeEach(() => vi.restoreAllMocks());

function renderDashboard(isAdmin = false) {
  const onOpenList = vi.fn();
  const onOpenTicket = vi.fn();
  const onOpenUsers = vi.fn();
  render(
    <StaffDashboard userName="Michael Brown" isAdmin={isAdmin} onOpenList={onOpenList} onOpenTicket={onOpenTicket} onOpenUsers={onOpenUsers} />,
  );
  return { onOpenList, onOpenTicket, onOpenUsers };
}

describe("StaffDashboard", () => {
  it("shows metric cards with labels and counts, including zeros", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(staffDashboard());
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Welcome back, Michael Brown!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unassigned: 4, view list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Assigned: 3, view list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting for Requester: 0, view list" })).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("My Planned Actions", { selector: "div" })).toBeInTheDocument();
  });

  it("drills down from cards, breakdown rows, and lists", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(staffDashboard());
    const { onOpenList, onOpenTicket } = renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "Unassigned: 4, view list" }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", { statusGroup: "active", owner: "unassigned" });

    await userEvent.click(screen.getByRole("button", { name: "Appears Resolved: 1, view list" }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", { statusGroup: "active", appearsResolved: "true" });

    await userEvent.click(screen.getByRole("button", { name: "Reopened: 1 tickets, view list" }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", { status: "REOPENED" });

    await userEvent.click(screen.getByRole("button", { name: "Not set priority: 1 tickets, view list" }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", { statusGroup: "active", itPriority: "UNSET" });

    await userEvent.click(screen.getByRole("button", { name: /Grade app is blank/ }));
    expect(onOpenTicket).toHaveBeenLastCalledWith(5);

    await userEvent.click(screen.getByRole("button", { name: /Disable add-ins/ }));
    expect(onOpenTicket).toHaveBeenLastCalledWith(2);
  });

  it("shows empty states for empty lists", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(
      staffDashboard({
        urgent: [],
        recentlyUpdated: [],
        metrics: { ...staffDashboard().metrics, myPlannedActions: { count: 0, items: [] } },
      }),
    );
    renderDashboard();
    expect(await screen.findByText("No urgent tickets right now.")).toBeInTheDocument();
    expect(screen.getByText("No active tickets.")).toBeInTheDocument();
    expect(screen.getByText("You have no planned actions.")).toBeInTheDocument();
  });

  it("UI-02: only Administrators see user accounts and system status", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(staffDashboard());
    const { unmount } = render(
      <StaffDashboard userName="IT Staff" isAdmin={false} onOpenList={vi.fn()} onOpenTicket={vi.fn()} />,
    );
    await screen.findByRole("heading", { name: /Welcome back/ });
    expect(screen.queryByRole("heading", { name: "User Accounts" })).not.toBeInTheDocument();
    unmount();

    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(
      staffDashboard({ users: { active: { REQUESTER: 5, IT_STAFF: 3, ADMINISTRATOR: 1 }, inactive: 2 } }),
    );
    const { onOpenUsers } = renderDashboard(true);
    expect(await screen.findByRole("heading", { name: "User Accounts" })).toBeInTheDocument();
    expect(screen.getByText("Active IT Staff").nextSibling).toHaveTextContent("3");
    expect(screen.getByRole("heading", { name: "System status" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Manage users" }));
    expect(onOpenUsers).toHaveBeenCalled();
  });

  it("shows a safe error with Retry, and a forbidden message on 403", async () => {
    const spy = vi.spyOn(api, "fetchStaffDashboard").mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(staffDashboard());
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Unassigned: 4, view list" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("shows a forbidden message when the API returns 403", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockRejectedValue(new api.ApiError("Forbidden", 403, { error: "FORBIDDEN" }));
    renderDashboard();
    expect(await screen.findByText("You do not have access to the staff dashboard.")).toBeInTheDocument();
  });
});

describe("StaffDashboard quick actions (final audit)", () => {
  it("opens My Queue and the full queue", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(staffDashboard());
    const { onOpenList } = renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: /My Queue/ }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", { statusGroup: "active", owner: "me" });
    await userEvent.click(screen.getByRole("button", { name: /Search All Tickets/ }));
    expect(onOpenList).toHaveBeenLastCalledWith("ticketQueue", {});
  });
});

describe("Readable labels in lists (final audit)", () => {
  it("the queue shows status and priority names, not raw codes", async () => {
    const { default: ITTicketQueue } = await import("../../src/ITTicketQueue");
    vi.spyOn(api, "fetchTicketQueue").mockResolvedValue({
      data: [
        {
          id: 1, ticketNumber: "TKT-2026-000001", summary: "VPN drops", categoryId: 1, requestedPriority: "HIGH",
          itPriority: null, currentStatus: "IN_PROGRESS", createdAt: "2026-10-20T01:00:00.000Z", updatedAt: "2026-10-20T01:00:00.000Z",
          requesterId: 3, ownerId: null, requesterName: "Sarah Johnson", ownerName: null,
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    render(<ITTicketQueue onSelectTicket={vi.fn()} />);
    expect((await screen.findAllByText("In Progress")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.queryByText("IN_PROGRESS")).not.toBeInTheDocument();
  });
});
