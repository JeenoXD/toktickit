// UI-03 and UI-08 in docs/lab-04/tests.md
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDashboard from "../../src/RequesterDashboard";
import App from "../../src/App";
import * as api from "../../src/api";
import { requesterDashboard, staffDashboard } from "./dashboardFixtures";

beforeEach(() => vi.restoreAllMocks());

function renderDashboard() {
  const handlers = { onOpenList: vi.fn(), onOpenTicket: vi.fn(), onCreateTicket: vi.fn() };
  render(<RequesterDashboard userName="Jennifer Anderson" {...handlers} />);
  return handlers;
}

describe("RequesterDashboard", () => {
  it("shows the four cards, highlights waiting tickets, and lists recent work", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(requesterDashboard());
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Welcome, Jennifer Anderson!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Open Tickets: 3, view list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed: 0, view list" })).toBeInTheDocument();
    expect(screen.getByText("Needs your reply")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains")).toBeInTheDocument();
    expect(screen.getByText("Docking station not detected")).toBeInTheDocument();
  });

  it("drills down to filtered My Tickets and opens tickets", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(requesterDashboard());
    const { onOpenList, onOpenTicket, onCreateTicket } = renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: "Waiting for Me: 1, view list" }));
    expect(onOpenList).toHaveBeenLastCalledWith("myTickets", { status: "WAITING_FOR_REQUESTER" });
    await userEvent.click(screen.getByRole("button", { name: /Laptop battery drains/ }));
    expect(onOpenTicket).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: /\+ Create Ticket/ }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it("shows zeros and a getting-started panel for a requester with no tickets", async () => {
    const empty = requesterDashboard({ recentlyUpdated: [], recentlyResolved: [] });
    for (const m of Object.values(empty.metrics)) m.count = 0;
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(empty);
    const { onCreateTicket } = renderDashboard();
    expect(await screen.findByText("You haven't submitted any tickets yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Open Tickets: 0, view list" })).toBeInTheDocument();
    expect(screen.queryByText("Needs your reply")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it("shows a safe error with Retry", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(requesterDashboard());
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "My Open Tickets: 3, view list" })).toBeInTheDocument();
  });
});

describe("UI-08: dashboard landing, active navigation, and drill-down", () => {
  it("lands IT Staff on the dashboard and drills into a filtered queue", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue({
      id: 7, name: "IT Support Staff", email: "it.staff@example.com", role: "IT_STAFF", requiresPasswordChange: false,
    });
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(staffDashboard());
    const queueSpy = vi.spyOn(api, "fetchTicketQueue").mockResolvedValue({
      data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: /Welcome back/ })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Ticket Queue" })).not.toHaveAttribute("aria-current");
    expect(within(nav).queryByRole("button", { name: /System Check/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Unassigned: 4, view list" }));
    await waitFor(() =>
      expect(queueSpy).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "active", owner: "unassigned" })),
    );
    expect(within(nav).getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Remove filter: Unassigned" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("active");

    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Unassigned" }));
    await waitFor(() => expect(queueSpy).toHaveBeenLastCalledWith(expect.objectContaining({ owner: undefined })));
  });

  it("lands Requesters on their dashboard and drills into filtered My Tickets", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue({
      id: 1, name: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", requiresPasswordChange: false,
    });
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(requesterDashboard());
    vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
    const listSpy = vi.spyOn(api, "fetchTickets").mockResolvedValue({
      data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Resolved: 2, view list" }));
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: "RESOLVED" })));
    expect(screen.getByLabelText("Status")).toHaveValue("RESOLVED");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  });
});
