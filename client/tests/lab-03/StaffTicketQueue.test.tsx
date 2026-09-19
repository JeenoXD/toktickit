import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as api from "../../src/api";
import ITTicketQueue from "../../src/ITTicketQueue";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ITTicketQueue", () => {
  it("renders the queue with filters and pagination", async () => {
    vi.spyOn(api, "fetchTicketQueue").mockResolvedValue({
      data: [{
        id: 1,
        ticketNumber: "TKT-000001",
        summary: "VPN access issue",
        categoryId: 1,
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        currentStatus: "NEW",
        requesterId: 2,
        ownerId: null,
        ownerName: null,
        requesterName: "Jennifer Anderson",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    render(<ITTicketQueue onSelectTicket={() => {}} />);

    expect(await screen.findByRole("heading", { name: /ticket queue/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by ticket number or summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/it priority/i)).toBeInTheDocument();
    expect(screen.getAllByText("TKT-000001").length).toBeGreaterThan(1);
  });

  it("shows the no-results state when filters match nothing", async () => {
    const fetchTicketQueueMock = vi.spyOn(api, "fetchTicketQueue");
    fetchTicketQueueMock.mockResolvedValueOnce({
      data: [{
        id: 1,
        ticketNumber: "TKT-000001",
        summary: "VPN access issue",
        categoryId: 1,
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        currentStatus: "NEW",
        requesterId: 2,
        ownerId: null,
        ownerName: null,
        requesterName: "Jennifer Anderson",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    render(<ITTicketQueue onSelectTicket={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText("TKT-000001").length).toBeGreaterThan(1);
    });

    fetchTicketQueueMock.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });

    fireEvent.change(screen.getByPlaceholderText(/search by ticket number or summary/i), {
      target: { value: "zzzznomatch" },
    });

    await waitFor(() => {
      expect(screen.getByText(/no tickets match your current filters/i)).toBeInTheDocument();
    });
  });
});
