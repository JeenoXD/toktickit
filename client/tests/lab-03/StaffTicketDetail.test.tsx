import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ITStaffTicketDetail from "../../src/ITStaffTicketDetail";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
  // Lab 4: the detail screen also loads staff users and the permitted status options.
  vi.spyOn(api, "fetchStaffUsers").mockResolvedValue([{ id: 5, name: "IT Support Staff", role: "IT_STAFF" }]);
  vi.spyOn(api, "fetchActions").mockResolvedValue([]);
  vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([]);
  vi.spyOn(api, "fetchAllowedTransitions").mockResolvedValue({
    currentStatus: "OPEN",
    version: 3,
    allowed: [
      { status: "IN_PROGRESS", blockedBy: [] },
      { status: "WAITING_FOR_REQUESTER", blockedBy: [] },
      { status: "CANCELLED", blockedBy: [] },
    ],
  });
});

describe("IT staff ticket detail", () => {
  it("renders public comments and internal notes as distinct sections", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery is draining faster",
      description: "The battery issue started after the update.",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      comments: [
        { id: 10, ticketId: 1, authorId: 2, content: "Requester updated the timeline.", createdAt: new Date().toISOString() },
      ],
      internalNotes: [
        { id: 20, ticketId: 1, authorId: 5, content: "Need to verify battery calibration.", createdAt: new Date().toISOString() },
      ],
      requesterId: 3,
      ownerId: 5,
    } as any);

    vi.spyOn(api, "fetchTicketComments").mockResolvedValue([
      { id: 10, ticketId: 1, authorId: 2, content: "Requester updated the timeline.", createdAt: new Date().toISOString() },
    ]);
    vi.spyOn(api, "fetchTicketNotes").mockResolvedValue([
      { id: 20, ticketId: 1, authorId: 5, content: "Need to verify battery calibration.", createdAt: new Date().toISOString() },
    ]);

    render(<ITStaffTicketDetail ticketId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Public Comments")).toBeInTheDocument();
      expect(screen.getByText("Internal Notes")).toBeInTheDocument();
    });

    expect(screen.getByText("Requester updated the timeline.")).toBeInTheDocument();
    expect(screen.getByText("Need to verify battery calibration.")).toBeInTheDocument();
    expect(screen.getByText("Internal Notes").closest("div")?.getAttribute("style") || "").toContain("255, 248, 225");
  });

  it("submits a new internal note and updates the ticket status", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery is draining faster",
      description: "The battery issue started after the update.",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      comments: [],
      internalNotes: [],
      requesterId: 3,
      ownerId: 5,
      version: 3,
    } as any);

    vi.spyOn(api, "fetchTicketComments").mockResolvedValue([]);
    vi.spyOn(api, "fetchTicketNotes").mockResolvedValue([]);
    vi.spyOn(api, "createTicketNote").mockResolvedValue({
      id: 1, ticketId: 1, authorId: 5, content: "Investigating battery drain.", createdAt: new Date().toISOString(),
    });
    vi.spyOn(api, "updateTicketStatus").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery is draining faster",
      description: "The battery issue started after the update.",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "IN_PROGRESS",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      comments: [],
      internalNotes: [],
      requesterId: 3,
      ownerId: 5,
    } as any);

    render(<ITStaffTicketDetail ticketId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Internal Notes")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/internal note/i), { target: { value: "Investigating battery drain." } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^status$/i), { target: { value: "IN_PROGRESS" } });
    fireEvent.click(screen.getByRole("button", { name: /save status/i }));

    await waitFor(() => {
      // Lab 4 BR-20: the current ticket version is sent with every workflow change.
      expect(api.updateTicketStatus).toHaveBeenCalledWith(1, "IN_PROGRESS", 3);
    });
  });
});
