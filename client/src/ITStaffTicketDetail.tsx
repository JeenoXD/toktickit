import { useEffect, useState } from "react";
import {
  ApiError,
  claimTicket,
  createTicketComment,
  createTicketNote,
  downloadAttachmentUrl,
  fetchAllowedTransitions,
  fetchStaffUsers,
  fetchTicketComments,
  fetchTicketDetail,
  fetchTicketNotes,
  reassignTicket,
  updateTicketPriority,
  updateTicketStatus,
  AllowedTransition,
  InternalNote,
  Priority,
  PublicComment,
  StaffUser,
  TicketDetail,
} from "./api.js";
import ActionsTaken from "./ActionsTaken";
import StatusHistory from "./StatusHistory";
import { BLOCK_REASON_LABELS, PRIORITY_LABELS, StatusBadge, statusLabel } from "./statusLabels";

type WorkflowField = "owner" | "priority" | "status";

export default function ITStaffTicketDetail({ ticketId }: { ticketId: number }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [allowed, setAllowed] = useState<AllowedTransition[]>([]);
  const [commentText, setCommentText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [priorityText, setPriorityText] = useState<string>("");
  const [reassignTo, setReassignTo] = useState<string>("");
  const [busy, setBusy] = useState<WorkflowField | null>(null);
  const [workflowError, setWorkflowError] = useState<{ field: WorkflowField; message: string; stale?: boolean } | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [postingComment, setPostingComment] = useState(false);
  const [postingNote, setPostingNote] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  async function loadAllowed() {
    try {
      const result = await fetchAllowedTransitions(ticketId);
      setAllowed(result.allowed);
      const firstOpen = result.allowed.find((a) => a.blockedBy.length === 0);
      setStatusText(firstOpen?.status ?? "");
    } catch {
      setAllowed([]);
    }
  }

  function applyTicket(updated: TicketDetail) {
    setTicket((current) => (current ? { ...current, ...updated } : updated));
    setPriorityText(updated.itPriority ?? "");
  }

  const loadTicket = async () => {
    setLoading(true);
    try {
      const detailResult = await fetchTicketDetail(ticketId);
      applyTicket(detailResult);

      const [commentsResult, notesResult] = await Promise.allSettled([
        fetchTicketComments(ticketId),
        fetchTicketNotes(ticketId),
        loadAllowed(),
      ]);

      setComments(commentsResult.status === "fulfilled" ? commentsResult.value : []);
      setNotes(notesResult.status === "fulfilled" ? notesResult.value : []);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTicket();
    fetchStaffUsers().then(setStaff).catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  /** Runs a versioned workflow change and handles stale/blocked/failed results the same way everywhere. */
  async function runWorkflow(field: WorkflowField, action: (version: number) => Promise<TicketDetail>, success: string) {
    if (!ticket || busy) return;
    setBusy(field);
    setWorkflowError(null);
    setWorkflowNotice(null);
    try {
      const updated = await action(ticket.version ?? 1);
      applyTicket(updated);
      if (updated.allowedTransitions) {
        setAllowed(updated.allowedTransitions);
        const firstOpen = updated.allowedTransitions.find((a) => a.blockedBy.length === 0);
        setStatusText(firstOpen?.status ?? "");
      } else {
        await loadAllowed();
      }
      setHistoryKey((k) => k + 1);
      setWorkflowNotice(success);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "STALE_UPDATE") {
        setWorkflowError({ field, message: "This ticket was changed by someone else. Reload to see the latest version.", stale: true });
      } else {
        setWorkflowError({ field, message: (err as Error).message || "Unable to update the ticket." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function reloadAfterConflict() {
    setWorkflowError(null);
    setWorkflowNotice(null);
    setHistoryKey((k) => k + 1);
    await loadTicket();
  }

  function handleClaim() {
    void runWorkflow("owner", (v) => claimTicket(ticketId, v), "Ticket claimed.");
  }

  function handleReassign() {
    if (!reassignTo) {
      setWorkflowError({ field: "owner", message: "Choose who to reassign the ticket to." });
      return;
    }
    void runWorkflow("owner", (v) => reassignTicket(ticketId, Number(reassignTo), v), "Ticket reassigned.");
  }

  function handlePrioritySave() {
    if (!priorityText) {
      setWorkflowError({ field: "priority", message: "Choose an IT Priority." });
      return;
    }
    void runWorkflow("priority", (v) => updateTicketPriority(ticketId, priorityText as Priority, v), "IT Priority saved.");
  }

  function handleStatusSave() {
    if (!statusText) {
      setWorkflowError({ field: "status", message: "Choose a new status." });
      return;
    }
    void runWorkflow("status", (v) => updateTicketStatus(ticketId, statusText, v), `Status changed to ${statusLabel(statusText)}.`);
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (postingComment) return; // prevents double submit
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError("Public comment cannot be empty.");
      return;
    }
    setPostingComment(true);
    try {
      const created = await createTicketComment(ticketId, trimmed);
      setComments((current) => [...current, created]);
      setCommentText("");
      setCommentError(null);
    } catch (err) {
      // The typed text stays in the box so it can be retried.
      setCommentError((err as Error).message || "Unable to post comment");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (postingNote) return; // prevents double submit
    const trimmed = noteText.trim();
    if (!trimmed) {
      setNoteError("Internal note cannot be empty.");
      return;
    }
    setPostingNote(true);
    try {
      const created = await createTicketNote(ticketId, trimmed);
      setNotes((current) => [...current, created]);
      setNoteText("");
      setNoteError(null);
    } catch (err) {
      setNoteError((err as Error).message || "Unable to add internal note");
    } finally {
      setPostingNote(false);
    }
  }

  function FieldMessage({ field }: { field: WorkflowField }) {
    if (workflowError?.field !== field) return null;
    return (
      <div className="text-danger small mt-2" role="alert">
        {workflowError.message}
        {workflowError.stale && (
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void reloadAfterConflict()}>
            Reload
          </button>
        )}
      </div>
    );
  }

  if (loading) return <p className="p-4">Loading ticket…</p>;
  if (!ticket) return <div className="alert alert-danger m-3">Unable to load this ticket.</div>;

  const ownerName = ticket.owner?.name ?? (ticket.ownerId ? `User #${ticket.ownerId}` : "Unassigned");
  const selectedOption = allowed.find((a) => a.status === statusText);
  const blockedOptions = allowed.filter((a) => a.blockedBy.length > 0);
  const locked = ticket.currentStatus === "CLOSED" || ticket.currentStatus === "CANCELLED";

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="mb-0">Ticket {ticket.ticketNumber}</h2>
        <StatusBadge status={ticket.currentStatus} />
      </div>

      {ticket.requesterResolvedAt && (
        <div className="alert alert-info" role="status">
          The requester says this problem appears resolved (
          {new Date(ticket.requesterResolvedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}).
          Review the work and resolve the ticket when it is confirmed.
        </div>
      )}

      {workflowNotice && (
        <div className="alert alert-success py-2" role="status">
          {workflowNotice}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card h-100 p-3">
            <strong>Current owner</strong>
            <div className="mb-2">{ownerName}</div>
            <button className="btn btn-success btn-sm mb-2 align-self-start" onClick={handleClaim} disabled={busy !== null}>
              Claim
            </button>
            <label htmlFor="reassign-owner" className="form-label small mb-1">Reassign to</label>
            <div className="d-flex gap-2">
              <select
                id="reassign-owner"
                className="form-select form-select-sm"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
              >
                <option value="">Choose staff…</option>
                {staff.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <button className="btn btn-outline-success btn-sm" onClick={handleReassign} disabled={busy !== null}>
                Reassign
              </button>
            </div>
            <FieldMessage field="owner" />
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card h-100 p-3">
            <label htmlFor="it-priority" className="form-label fw-bold">IT Priority</label>
            <select id="it-priority" aria-label="IT priority" className="form-select" value={priorityText} onChange={(e) => setPriorityText(e.target.value)}>
              {!ticket.itPriority && <option value="">Not set</option>}
              {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-success mt-2 align-self-start" onClick={handlePrioritySave} disabled={busy !== null}>
              {busy === "priority" ? "Saving…" : "Save Priority"}
            </button>
            <FieldMessage field="priority" />
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card h-100 p-3">
            <label htmlFor="ticket-status" className="form-label fw-bold">Status</label>
            {allowed.length === 0 ? (
              <p className="small text-muted mb-0">No further status changes are available for this ticket.</p>
            ) : (
              <>
                <select
                  id="ticket-status"
                  className="form-select"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  aria-describedby="status-hint"
                >
                  {!allowed.some((a) => a.blockedBy.length === 0) && <option value="">Choose…</option>}
                  {allowed.map((option) => (
                    <option key={option.status} value={option.status} disabled={option.blockedBy.length > 0}>
                      {statusLabel(option.status)}
                      {option.blockedBy.length > 0 ? " (blocked)" : ""}
                    </option>
                  ))}
                </select>
                <div id="status-hint" className="small text-muted mt-1">
                  Allowed: {allowed.map((a) => statusLabel(a.status)).join(", ")}
                </div>
                {blockedOptions.map((option) => (
                  <div key={option.status} className="small text-muted">
                    {statusLabel(option.status)}: {option.blockedBy.map((r) => BLOCK_REASON_LABELS[r] ?? r).join("; ")}.
                  </div>
                ))}
                <button
                  className="btn btn-sm btn-success mt-2 align-self-start"
                  onClick={handleStatusSave}
                  disabled={busy !== null || !selectedOption || selectedOption.blockedBy.length > 0}
                >
                  {busy === "status" ? "Saving…" : "Save Status"}
                </button>
              </>
            )}
            <FieldMessage field="status" />
          </div>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="row g-3">
          <div className="col-12 col-md-6"><strong>Summary</strong><div style={{ wordBreak: "break-word" }}>{ticket.summary}</div></div>
          <div className="col-6 col-md-3"><strong>Requester</strong><div>{ticket.requester?.name ?? "Unknown"}</div></div>
          <div className="col-6 col-md-3"><strong>Requested Priority</strong><div>{PRIORITY_LABELS[ticket.requestedPriority] ?? ticket.requestedPriority}</div></div>
          <div className="col-12"><strong>Description</strong><div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{ticket.description}</div></div>
          <div className="col-12"><strong>Created</strong><div>{new Date(ticket.createdAt).toLocaleString()}</div></div>
        </div>
      </div>

      <section className="card p-3 mb-4" aria-labelledby="staff-attachments-title">
        <h3 id="staff-attachments-title" className="h5 mb-3">Attachments</h3>
        {(ticket.attachments ?? []).length === 0 ? (
          <p className="text-muted mb-0">No attachments on this ticket.</p>
        ) : (
          <ul className="list-group">
            {ticket.attachments.map((a) => (
              <li key={a.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span style={{ wordBreak: "break-word" }}>
                  {a.removedAt ? (
                    <>
                      <span className="text-muted text-decoration-line-through">{a.filename}</span>{" "}
                      <span className="badge bg-secondary">Removed</span>
                      {a.removedReason && <span className="small text-muted d-block">Reason: {a.removedReason}</span>}
                    </>
                  ) : (
                    <a href={downloadAttachmentUrl(a.id)} target="_blank" rel="noreferrer">{a.filename}</a>
                  )}
                </span>
                <span className="small text-muted">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionsTaken
        ticketId={ticket.id}
        ticketLocked={locked}
        onChanged={() => void loadAllowed()}
      />

      <StatusHistory ticketId={ticket.id} refreshKey={historyKey} />

      <div className="card p-3 mb-4">
        <h3 className="h5 mb-3">Public Comments</h3>
        <ul className="list-group mb-3">
          {comments.length === 0 && <li className="list-group-item text-muted">No public comments yet.</li>}
          {comments.map((comment) => (
            <li key={comment.id} className="list-group-item">
              <div>{comment.content}</div>
              <small className="text-muted">{new Date(comment.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
        <form onSubmit={handleCommentSubmit}>
          <label htmlFor="public-comment" className="form-label">Add public comment</label>
          <textarea id="public-comment" className="form-control mb-2" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          {commentError && <div className="text-danger small mb-2" role="alert">{commentError}</div>}
          <button type="submit" className="btn btn-success" disabled={postingComment}>{postingComment ? "Posting…" : "Post Comment"}</button>
        </form>
      </div>

      <div className="card p-3 mb-4" style={{ background: "rgb(255, 248, 225)" }}>
        <h3 className="h5 mb-3">Internal Notes</h3>
        <ul className="list-group mb-3">
          {notes.length === 0 && <li className="list-group-item text-muted">No internal notes yet.</li>}
          {notes.map((note) => (
            <li key={note.id} className="list-group-item">
              <div>{note.content}</div>
              <small className="text-muted">{new Date(note.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
        <form onSubmit={handleNoteSubmit}>
          <label htmlFor="internal-note" className="form-label">Internal note</label>
          <textarea id="internal-note" className="form-control mb-2" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          {noteError && <div className="text-danger small mb-2" role="alert">{noteError}</div>}
          <button type="submit" className="btn btn-warning" disabled={postingNote}>{postingNote ? "Adding…" : "Add Note"}</button>
        </form>
      </div>
    </div>
  );
}
