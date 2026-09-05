import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RequesterTicketDetail from "../../src/RequesterTicketDetail";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

beforeEach(() => vi.restoreAllMocks());

it("renders read-only ticket header fields (UI-10)", async () => {
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
  });

  render(
    <RequesterProvider initialRequester={{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }}>
      <RequesterTicketDetail ticketId={1} />
    </RequesterProvider>
  );

  await waitFor(() => {
    expect(screen.getByText("TKT-2026-000001", { exact: false })).toBeInTheDocument();
  });
  expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
  expect(screen.getByText("Battery drains fast since the last update.")).toBeInTheDocument();
});