import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RequesterTicketDetail from "../../src/RequesterTicketDetail";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Requester ticket detail public comment flow", () => {
  it("renders public comments and allows marking the issue as appears resolved", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast since the last update.",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: null,
      currentStatus: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      comments: [
        { id: 10, content: "The workaround is holding for now.", createdAt: new Date().toISOString(), authorId: 1 },
      ],
    });

    const markResolved = vi.spyOn(api, "markTicketAppearsResolved").mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Laptop battery drains quickly",
      description: "Battery drains fast since the last update.",
      categoryId: 1,
      requestedPriority: "MEDIUM",
      itPriority: null,
      currentStatus: "WAITING_FOR_REQUESTER",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      comments: [],
    });

    render(
      <RequesterProvider initialRequester={{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }}>
        <RequesterTicketDetail ticketId={1} />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Public Comments")).toBeInTheDocument();
    });

    expect(screen.getByText("The workaround is holding for now.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /problem appears resolved/i }));

    await waitFor(() => {
      expect(markResolved).toHaveBeenCalledWith(1);
    });
  });
});
