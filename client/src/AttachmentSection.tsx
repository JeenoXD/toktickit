import { useState } from "react";
import { Attachment, uploadAttachment, removeAttachment, downloadAttachmentUrl } from "./api.js";
import { useRequester } from "./RequesterContext";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export default function AttachmentSection({
  ticketId,
  attachments,
  onChange,
}: {
  ticketId: number;
  attachments: Attachment[];
  onChange: () => void;
}) {
  const { requester } = useRequester();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reasonInput, setReasonInput] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !requester) return;

    setUploadError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError("File exceeds the 5 MB size limit.");
      return;
    }
    const activeCount = attachments.filter((a) => !a.removedAt).length;
    if (activeCount >= 5) {
      setUploadError("Maximum of 5 active attachments per ticket.");
      return;
    }

    try {
      await uploadAttachment(ticketId, requester.id, file);
      onChange();
    } catch (err) {
      setUploadError((err as Error).message);
    }
  }

  async function confirmRemove(attachmentId: number) {
    if (!requester || !reasonInput.trim()) return;
    try {
      await removeAttachment(attachmentId, requester.id, reasonInput.trim());
      setRemovingId(null);
      setReasonInput("");
      onChange();
    } catch (err) {
      setUploadError((err as Error).message);
    }
  }

  return (
    <div className="card p-3 mt-3">
      <h5>Attachments</h5>

      <input
        type="file"
        className="form-control mb-2"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        onChange={handleFileSelect}
      />
      {uploadError && <div className="text-danger small mb-2">{uploadError}</div>}

      <ul className="list-group">
        {attachments.map((a) => (
          <li key={a.id} className={`list-group-item ${a.removedAt ? "text-muted" : ""}`}>
            <div className="d-flex justify-content-between align-items-center">
              <span>
                {a.filename} ({Math.round(a.sizeBytes / 1024)} KB)
                {a.removedAt && <span className="badge bg-secondary ms-2">Removed</span>}
              </span>
              {!a.removedAt && requester && (
                <div>
                  <a
                    className="btn btn-sm btn-outline-primary me-2"
                    href={downloadAttachmentUrl(a.id, requester.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => setRemovingId(a.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            {a.removedAt && a.removedReason && (
              <div className="small text-muted mt-1">Reason: {a.removedReason}</div>
            )}
            {removingId === a.id && (
              <div className="mt-2 d-flex gap-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Reason for removal"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                />
                <button className="btn btn-sm btn-danger" onClick={() => confirmRemove(a.id)}>
                  Confirm
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setRemovingId(null)}>
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}