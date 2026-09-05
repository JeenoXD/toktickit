import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyTickets from "../../src/MyTickets";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
});

function renderWithRequester() {
  render(
    <RequesterProvider initialRequester={{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }}>
        <MyTickets onSelectTicket={() => {}} />
    </RequesterProvider>
    );
}

it("shows the empty-list state when the requester has zero tickets (UI-06)", async () => {
  vi.spyOn(api, "fetchTickets").mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  });

  renderWithRequester();

  await waitFor(() => {
    expect(screen.getByText(/no tickets yet/i)).toBeInTheDocument();
  });
});

it("shows a distinct no-results state when a search matches nothing (UI-05)", async () => {
  // First call (initial load, no search yet) returns real data.
  const fetchTicketsMock = vi.spyOn(api, "fetchTickets");
  fetchTicketsMock.mockResolvedValueOnce({
    data: [{
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery drains quickly",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: null,
      currentStatus: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  });

  renderWithRequester();

  await waitFor(() => {
    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
  });

  // Second call (after typing a search term) returns no matches.
  fetchTicketsMock.mockResolvedValueOnce({
    data: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  });

  const searchInput = screen.getByPlaceholderText(/search by ticket number or summary/i);
  fireEvent.change(searchInput, { target: { value: "zzzznomatch" } });

  await waitFor(() => {
    expect(screen.getByText(/no tickets match your current search or filters/i)).toBeInTheDocument();
  });

  // Confirm it's genuinely distinct from the empty-list copy, not the same message reused.
  expect(screen.queryByText(/no tickets yet/i)).not.toBeInTheDocument();
});