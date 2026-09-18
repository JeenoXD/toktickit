import { useState } from "react";
import { Attachment, uploadAttachment, removeAttachment, downloadAttachmentUrl } from "./api.js";
import { useAuth } from "./AuthContext.js";
import { useRequester } from "./RequesterContext.js";

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
  let authUser = null as { id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; requiresPasswordChange: boolean } | null;
  let requesterUser = null as { id: number; name: string; email: string } | null;

  try {
    authUser = useAuth().user;
  } catch {
    authUser = null;
  }
  try {
    requesterUser = useRequester().requester;
  } catch {
    requesterUser = null;
  }

  const user = authUser ?? (requesterUser ? {
    id: requesterUser.id,
    name: requesterUser.name,
    email: requesterUser.email,
    role: "REQUESTER" as const,
    requiresPasswordChange: false,
  } : null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reasonInput, setReasonInput] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

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
      if (authUser) {
        await uploadAttachment(ticketId, file);
      } else if (requesterUser) {
        await uploadAttachment(ticketId, requesterUser.id, file);
      }
      onChange();
    } catch (err) {
      setUploadError((err as Error).message);
    }
  }

  async function confirmRemove(attachmentId: number) {
    if (!user || !reasonInput.trim()) return;
    try {
      if (authUser) {
        await removeAttachment(attachmentId, reasonInput.trim());
      } else if (requesterUser) {
        await removeAttachment(attachmentId, requesterUser.id, reasonInput.trim());
      }
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
              {!a.removedAt && user && (
                <div>
                  <a
                    className="btn btn-sm btn-outline-primary me-2"
                    href={downloadAttachmentUrl(a.id)}
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