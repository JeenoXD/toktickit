import { useEffect, useMemo, useState } from "react";
import {
  claimTicket,
  createTicketComment,
  createTicketNote,
  fetchTicketComments,
  fetchTicketDetail,
  fetchTicketNotes,
  reassignTicket,
  updateTicketPriority,
  updateTicketStatus,
  TicketDetail,
  PublicComment,
  InternalNote,
} from "./api.js";

const statusTransitions: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN"],
  WAITING_FOR_REQUESTER: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS"],
  CANCELLED: ["REOPENED"],
};

const staffUsers = [
  { id: 6, name: "IT Support Staff" },
  { id: 7, name: "System Admin" },
];

export default function ITStaffTicketDetail({ ticketId }: { ticketId: number }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [commentText, setCommentText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [statusText, setStatusText] = useState<string>("OPEN");
  const [priorityText, setPriorityText] = useState<string>("LOW");
  const [ownerId, setOwnerId] = useState<number | "">("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const detailResult = await fetchTicketDetail(ticketId);
      setTicket(detailResult);
      setStatusText(detailResult.currentStatus);
      setPriorityText(detailResult.itPriority ?? "LOW");
      setOwnerId(detailResult.ownerId ?? "");

      const [commentsResult, notesResult] = await Promise.allSettled([
        fetchTicketComments(ticketId),
        fetchTicketNotes(ticketId),
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
  }, [ticketId]);

  const allowedStatuses = useMemo(() => statusTransitions[ticket?.currentStatus ?? "NEW"] ?? [], [ticket]);

  async function handleClaim() {
    try {
      const updated = await claimTicket(ticketId);
      setTicket((current) => (current ? { ...current, ownerId: updated.ownerId ?? current.ownerId } : current));
      setOwnerId(updated.ownerId ?? "");
    } catch (err) {
      setStatusError((err as Error).message || "Unable to claim ticket");
    }
  }

  async function handleReassign() {
    if (!ownerId || ownerId === "") return;
    try {
      const updated = await reassignTicket(ticketId, Number(ownerId));
      setTicket((current) => (current ? { ...current, ownerId: updated.ownerId ?? current.ownerId } : current));
    } catch (err) {
      setStatusError((err as Error).message || "Unable to reassign ticket");
    }
  }

  async function handlePrioritySave() {
    try {
      const updated = await updateTicketPriority(ticketId, priorityText as "LOW" | "MEDIUM" | "HIGH");
      setTicket((current) => (current ? { ...current, itPriority: updated.itPriority ?? current.itPriority } : current));
      setPriorityError(null);
    } catch (err) {
      setPriorityError((err as Error).message || "Unable to update priority");
    }
  }

  async function handleStatusSave() {
    try {
      const updated = await updateTicketStatus(ticketId, statusText);
      setTicket((current) => (current ? { ...current, currentStatus: updated.currentStatus } : current));
      setStatusError(null);
    } catch (err) {
      setStatusError((err as Error).message || "Unable to update status");
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError("Public comment cannot be empty.");
      return;
    }
    try {
      const created = await createTicketComment(ticketId, trimmed);
      setComments((current) => [...current, created]);
      setCommentText("");
      setCommentError(null);
    } catch (err) {
      setCommentError((err as Error).message || "Unable to post comment");
    }
  }

  async function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) {
      setNoteError("Internal note cannot be empty.");
      return;
    }
    try {
      const created = await createTicketNote(ticketId, trimmed);
      setNotes((current) => [...current, created]);
      setNoteText("");
      setNoteError(null);
    } catch (err) {
      setNoteError((err as Error).message || "Unable to add internal note");
    }
  }

  if (loading) return <p className="p-4">Loading ticket…</p>;
  if (!ticket) return <div className="alert alert-danger m-3">Unable to load this ticket.</div>;

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Ticket {ticket.ticketNumber}</h2>
        <div className="d-flex gap-2 align-items-center">
          <select aria-label="Claim or reassign ticket" className="form-select" value={ownerId} onChange={(e) => setOwnerId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Unassigned</option>
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleClaim}>Claim</button>
          <button className="btn btn-outline-primary" onClick={handleReassign}>Reassign</button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <label className="form-label">IT Priority</label>
          <select aria-label="IT priority" className="form-select" value={priorityText} onChange={(e) => setPriorityText(e.target.value)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <button className="btn btn-sm btn-success mt-2" onClick={handlePrioritySave}>Save Priority</button>
          {priorityError && <div className="text-danger small mt-2">{priorityError}</div>}
        </div>
        <div className="col-md-4">
          <label className="form-label">Status</label>
          <select aria-label="Status" className="form-select" value={statusText} onChange={(e) => setStatusText(e.target.value)}>
            {Object.keys(statusTransitions).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <div className="small text-muted mt-1">Allowed: {allowedStatuses.join(", ") || "None"}</div>
          <button className="btn btn-sm btn-success mt-2" onClick={handleStatusSave}>Save Status</button>
          {statusError && <div className="text-danger small mt-2">{statusError}</div>}
        </div>
        <div className="col-md-4">
          <div className="card h-100 p-3 bg-light">
            <strong>Requester</strong>
            <div>{ticket.requesterId ?? "Unknown"}</div>
            <strong className="mt-2">Current owner</strong>
            <div>{ticket.ownerId ?? "Unassigned"}</div>
          </div>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="row g-3">
          <div className="col-md-6"><strong>Summary</strong><div>{ticket.summary}</div></div>
          <div className="col-md-3"><strong>Requested Priority</strong><div>{ticket.requestedPriority}</div></div>
          <div className="col-md-3"><strong>Created</strong><div>{new Date(ticket.createdAt).toLocaleString()}</div></div>
          <div className="col-12"><strong>Description</strong><div>{ticket.description}</div></div>
        </div>
      </div>

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
          <label className="form-label">Add public comment</label>
          <textarea className="form-control mb-2" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          {commentError && <div className="text-danger small mb-2">{commentError}</div>}
          <button type="submit" className="btn btn-success">Post Comment</button>
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
          {noteError && <div className="text-danger small mb-2">{noteError}</div>}
          <button type="submit" className="btn btn-warning">Add Note</button>
        </form>
      </div>
    </div>
  );
}
