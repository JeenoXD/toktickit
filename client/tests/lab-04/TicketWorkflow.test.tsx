// UI-07 in docs/lab-04/tests.md: workflow controls on Ticket Detail.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ITStaffTicketDetail from "../../src/ITStaffTicketDetail";
import RequesterTicketDetail from "../../src/RequesterTicketDetail";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

const baseTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "VPN keeps dropping",
  description: "Connection drops every few minutes.",
  categoryId: 1,
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "IN_PROGRESS",
  createdAt: "2026-10-20T01:00:00.000Z",
  updatedAt: "2026-10-20T01:00:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
  requesterId: 3,
  requester: { id: 3, name: "Sarah Johnson" },
  ownerId: 6,
  owner: { id: 6, name: "IT Support Staff" },
  version: 4,
  requesterResolvedAt: null,
} as unknown as api.TicketDetail;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(baseTicket);
  vi.spyOn(api, "fetchTicketComments").mockResolvedValue([]);
  vi.spyOn(api, "fetchTicketNotes").mockResolvedValue([]);
  vi.spyOn(api, "fetchActions").mockResolvedValue([]);
  vi.spyOn(api, "fetchStaffUsers").mockResolvedValue([
    { id: 6, name: "IT Support Staff", role: "IT_STAFF" },
    { id: 7, name: "Carlos Mendez", role: "IT_STAFF" },
  ]);
  vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([
    { id: 1, fromStatus: null, toStatus: "NEW", changedBy: { id: 3, name: "Sarah Johnson" }, changedAt: "2026-10-20T01:00:00.000Z" },
    { id: 2, fromStatus: "NEW", toStatus: "OPEN", changedBy: { id: 6, name: "IT Support Staff" }, changedAt: "2026-10-20T02:00:00.000Z" },
  ]);
  vi.spyOn(api, "fetchAllowedTransitions").mockResolvedValue({
    currentStatus: "IN_PROGRESS",
    version: 4,
    allowed: [
      { status: "OPEN", blockedBy: [] },
      { status: "WAITING_FOR_REQUESTER", blockedBy: [] },
      { status: "RESOLVED", blockedBy: ["NO_COMPLETED_ACTION"] },
    ],
  });
});

describe("IT Staff workflow controls", () => {
  it("shows only permitted next statuses and explains blocked ones", async () => {
    render(<ITStaffTicketDetail ticketId={1} />);
    const select = await screen.findByLabelText(/^Status$/);
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Open", "Waiting for Requester", "Resolved (blocked)"]);
    expect(within(select).getByRole("option", { name: "Resolved (blocked)" })).toBeDisabled();
    expect(screen.getByText(/Resolved: needs at least one completed action/)).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Closed" })).not.toBeInTheDocument();
  });

  it("shows the owner by name and the status history", async () => {
    render(<ITStaffTicketDetail ticketId={1} />);
    expect(await screen.findByText("Current owner")).toBeInTheDocument();
    const ownerCard = screen.getByText("Current owner").closest(".card") as HTMLElement;
    expect(within(ownerCard).getByText("IT Support Staff", { selector: "div" })).toBeInTheDocument();
    const history = screen.getByRole("heading", { name: "Status History" }).closest("section") as HTMLElement;
    expect(await within(history).findByText(/Created as/)).toBeInTheDocument();
    expect(within(history).getByText("by IT Support Staff")).toBeInTheDocument();
  });

  it("sends the version with a status change and refreshes options", async () => {
    const updateSpy = vi.spyOn(api, "updateTicketStatus").mockResolvedValue({
      ...baseTicket,
      currentStatus: "WAITING_FOR_REQUESTER",
      version: 5,
      allowedTransitions: [{ status: "IN_PROGRESS", blockedBy: [] }],
    });
    render(<ITStaffTicketDetail ticketId={1} />);
    await userEvent.selectOptions(await screen.findByLabelText(/^Status$/), "WAITING_FOR_REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Save Status" }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(1, "WAITING_FOR_REQUESTER", 4));
    expect(await screen.findByText("Status changed to Waiting for Requester.")).toBeInTheDocument();
    expect(within(screen.getByLabelText(/^Status$/)).getAllByRole("option").map((o) => o.textContent)).toEqual(["In Progress"]);
  });

  it("shows a conflict message with Reload when the ticket changed elsewhere", async () => {
    vi.spyOn(api, "updateTicketStatus").mockRejectedValue(new api.ApiError("stale", 409, { error: "STALE_UPDATE" }));
    const detailSpy = vi.spyOn(api, "fetchTicketDetail");
    render(<ITStaffTicketDetail ticketId={1} />);
    await userEvent.selectOptions(await screen.findByLabelText(/^Status$/), "OPEN");
    await userEvent.click(screen.getByRole("button", { name: "Save Status" }));

    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(detailSpy).toHaveBeenCalledTimes(2));
  });

  it("shows server workflow errors such as the resolution gate", async () => {
    vi.spyOn(api, "fetchAllowedTransitions").mockResolvedValue({
      currentStatus: "IN_PROGRESS",
      version: 4,
      allowed: [{ status: "RESOLVED", blockedBy: [] }],
    });
    vi.spyOn(api, "updateTicketStatus").mockRejectedValue(
      new api.ApiError("This ticket cannot be resolved yet.", 409, { error: "RESOLUTION_GATE_FAILED" }),
    );
    render(<ITStaffTicketDetail ticketId={1} />);
    await userEvent.click(await screen.findByRole("button", { name: "Save Status" }));
    expect(await screen.findByText("This ticket cannot be resolved yet.")).toBeInTheDocument();
  });

  it("claims, reassigns from the active staff list, and saves priority with the version", async () => {
    const claimSpy = vi.spyOn(api, "claimTicket").mockResolvedValue({ ...baseTicket, version: 5 });
    const reassignSpy = vi.spyOn(api, "reassignTicket").mockResolvedValue({
      ...baseTicket,
      version: 6,
      ownerId: 7,
      owner: { id: 7, name: "Carlos Mendez" },
    });
    const prioritySpy = vi.spyOn(api, "updateTicketPriority").mockResolvedValue({ ...baseTicket, itPriority: "LOW", version: 7 });
    render(<ITStaffTicketDetail ticketId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: "Claim" }));
    await waitFor(() => expect(claimSpy).toHaveBeenCalledWith(1, 4));

    await userEvent.selectOptions(screen.getByLabelText("Reassign to"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(reassignSpy).toHaveBeenCalledWith(1, 7, 5));
    const ownerCard = screen.getByText("Current owner").closest(".card") as HTMLElement;
    expect(within(ownerCard).getByText("Carlos Mendez", { selector: "div" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("IT priority"), "LOW");
    await userEvent.click(screen.getByRole("button", { name: "Save Priority" }));
    await waitFor(() => expect(prioritySpy).toHaveBeenCalledWith(1, "LOW", 6));
  });

  it("shows the requester's appears-resolved flag", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({ ...baseTicket, requesterResolvedAt: "2026-10-20T05:00:00.000Z" });
    render(<ITStaffTicketDetail ticketId={1} />);
    expect(await screen.findByText(/requester says this problem appears resolved/i)).toBeInTheDocument();
  });

  it("explains when no status change is available", async () => {
    vi.spyOn(api, "fetchAllowedTransitions").mockResolvedValue({ currentStatus: "CANCELLED", version: 4, allowed: [] });
    render(<ITStaffTicketDetail ticketId={1} />);
    expect(await screen.findByText(/No further status changes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Status" })).not.toBeInTheDocument();
  });
});

describe("Requester appears-resolved flag", () => {
  function renderRequester() {
    return render(
      <RequesterProvider initialRequester={{ id: 3, name: "Sarah Johnson", email: "sarah@example.com" }}>
        <RequesterTicketDetail ticketId={1} />
      </RequesterProvider>,
    );
  }

  it("flags without changing status and then shows the confirmation text", async () => {
    const flagSpy = vi.spyOn(api, "markTicketAppearsResolved").mockResolvedValue({
      ...baseTicket,
      requesterResolvedAt: "2026-10-20T06:00:00.000Z",
    });
    renderRequester();
    await userEvent.click(await screen.findByRole("button", { name: "Problem Appears Resolved" }));
    expect(flagSpy).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/You marked this as appearing resolved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).not.toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("hides the button for resolved tickets and shows the history", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({ ...baseTicket, currentStatus: "RESOLVED" });
    renderRequester();
    expect(await screen.findByRole("heading", { name: "Status History" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).not.toBeInTheDocument();
  });
});
