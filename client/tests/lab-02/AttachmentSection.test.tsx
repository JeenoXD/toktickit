import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttachmentSection from "../../src/AttachmentSection";
import { RequesterProvider } from "../../src/RequesterContext";
import * as api from "../../src/api";

beforeEach(() => vi.restoreAllMocks());

function renderWithRequester(attachments: api.Attachment[]) {
  render(
    <RequesterProvider initialRequester={{ id: 1, name: "Jennifer Anderson", email: "j@example.com" }}>
      <AttachmentSection ticketId={1} attachments={attachments} onChange={() => {}} />
    </RequesterProvider>
  );
}

it("rejects an oversized attachment client-side (UI-09)", async () => {
  renderWithRequester([]);
  const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [bigFile] } });

  await waitFor(() => {
    expect(screen.getByText(/exceeds the 5 MB size limit/i)).toBeInTheDocument();
  });
});

it("shows the removal confirmation flow and calls removeAttachment with a reason (UI-08)", async () => {
  const removeMock = vi.spyOn(api, "removeAttachment").mockResolvedValue({
    id: 1, filename: "test.png", sizeBytes: 1000,
    uploadedAt: new Date().toISOString(), removedAt: new Date().toISOString(), removedReason: "wrong file",
  });

  renderWithRequester([{
    id: 1, filename: "test.png", sizeBytes: 1000,
    uploadedAt: new Date().toISOString(), removedAt: null, removedReason: null,
  }]);

  fireEvent.click(screen.getByText("Remove"));
  const reasonInput = screen.getByPlaceholderText(/reason for removal/i);
  fireEvent.change(reasonInput, { target: { value: "wrong file" } });
  fireEvent.click(screen.getByText("Confirm"));

  await waitFor(() => {
    expect(removeMock).toHaveBeenCalledWith(1, 1, "wrong file");
  });
});