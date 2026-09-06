import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RequesterSelection from "../../src/RequesterSelection";
import { RequesterProvider } from "../../src/RequesterContext";

beforeEach(() => {
  vi.restoreAllMocks();
});

it("shows loading then the dropdown on success", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }],
  } as Response);

  render(<RequesterProvider><RequesterSelection /></RequesterProvider>);
  expect(screen.getByText(/Loading requesters/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Select Development Requester")).toBeInTheDocument());
});

it("shows empty state when no active requesters exist", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => [] } as Response);
  render(<RequesterProvider><RequesterSelection /></RequesterProvider>);
  await waitFor(() => expect(screen.getByText(/No active requesters/i)).toBeInTheDocument());
});

it("shows an error state when the API fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
  render(<RequesterProvider><RequesterSelection /></RequesterProvider>);
  await waitFor(() => expect(screen.getByText(/Unable to load requesters/i)).toBeInTheDocument());
});