import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateTicket from "../../src/CreateTicket";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
});

function renderWithRequester() {
  render(
    <RequesterProvider initialRequester={{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }}>
      <CreateTicket />
    </RequesterProvider>
  );
}

it("shows a field error when Summary is empty on submit (UI-02)", async () => {
  renderWithRequester();
  await waitFor(() => screen.getByText("Create Ticket"));

  fireEvent.click(screen.getByText("Submit Ticket"));

  await waitFor(() => {
    expect(screen.getByText(/Summary must be between/i)).toBeInTheDocument();
  });
});

it("disables the submit button while submitting (UI-03)", async () => {
  vi.spyOn(api, "createTicket").mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({ id: 1, ticketNumber: "TKT-2026-000001" }), 100))
  );
  renderWithRequester();
  await waitFor(() => screen.getByText("Create Ticket"));

  fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/Related System/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/^Summary/i), { target: { value: "Valid summary text" } });
  fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: "Valid description text long enough." } });

  fireEvent.click(screen.getByText("Submit Ticket"));

  await waitFor(() => {
    expect(screen.getByText("Submitting…")).toBeDisabled();
  });
});

it("shows a safe error and preserves form values on API failure (UI-04)", async () => {
  vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Unable to connect to TokTickIT API"));
  renderWithRequester();
  await waitFor(() => screen.getByText("Create Ticket"));

  const summaryInput = screen.getByLabelText(/^Summary/i) as HTMLInputElement;
  fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/Related System/i), { target: { value: "1" } });
  fireEvent.change(summaryInput, { target: { value: "Valid summary text" } });
  fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: "Valid description text long enough." } });

  fireEvent.click(screen.getByText("Submit Ticket"));

  await waitFor(() => {
    expect(screen.getByText(/Unable to connect to TokTickIT API/i)).toBeInTheDocument();
  });
  expect(summaryInput.value).toBe("Valid summary text");
});

it("rejects an oversized attachment client-side (UI-09)", async () => {
  renderWithRequester();
  await waitFor(() => screen.getByText("Create Ticket"));

  const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
  const input = screen.getByLabelText(/Attachments/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [bigFile] } });

  await waitFor(() => {
    expect(screen.getByText(/exceeds the 5 MB size limit/i)).toBeInTheDocument();
  });
});