import { useEffect, useState } from "react";
import { createTicketComment, fetchTicketDetail, markTicketAppearsResolved, TicketDetail } from "./api.js";
import AttachmentSection from "./AttachmentSection";
import ActionsTaken from "./ActionsTaken";
import StatusHistory from "./StatusHistory";
import { PRIORITY_LABELS, StatusBadge } from "./statusLabels";
import { useRequester } from "./RequesterContext.js";

type LoadState = "loading" | "success" | "error";

export default function RequesterTicketDetail({ ticketId }: { ticketId: number }) {
  let requesterUser = null as { id: number; name: string; email: string } | null;

  try {
    requesterUser = useRequester().requester;
  } catch {
    requesterUser = null;
  }

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  function load() {
    if (requesterUser === null) {
      setState("error");
      return;
    }

    setState("loading");
    fetchTicketDetail(ticketId)
      .then((t) => {
        setTicket(t);
        setState("success");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, [ticketId]);

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (postingComment) return; // prevents double submit
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    setPostingComment(true);
    try {
      await createTicketComment(ticketId, trimmed);
      setCommentText("");
      setCommentError(null);
      load();
    } catch (err) {
      // The typed text stays in the box so it can be retried.
      setCommentError((err as Error).message || "Unable to post comment");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleAppearsResolved() {
    if (flagging) return;
    setFlagging(true);
    setFlagError(null);
    try {
      const updated = await markTicketAppearsResolved(ticketId);
      // Lab 4 BR-19: advisory only, so the status stays as it was.
      setTicket((current) => (current ? { ...current, requesterResolvedAt: updated.requesterResolvedAt } : current));
    } catch (err) {
      setFlagError((err as Error).message || "Unable to update the ticket");
    } finally {
      setFlagging(false);
    }
  }

  if (state === "loading") return <p>Loading ticket…</p>;
  if (state === "error" || !ticket) return <p className="text-danger">Unable to load this ticket.</p>;

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h2>Ticket {ticket.ticketNumber}</h2>

      <div className="card p-3 mb-3" style={{ background: "#F0F1EE" }}>
        <div className="row mb-2">
          <div className="col-6"><strong>Requested Priority</strong><div>{PRIORITY_LABELS[ticket.requestedPriority] ?? ticket.requestedPriority}</div></div>
          <div className="col-6"><strong>Current Status</strong><div><StatusBadge status={ticket.currentStatus} /></div></div>
        </div>
        <div className="mb-2"><strong>Summary</strong><div>{ticket.summary}</div></div>
        <div className="mb-2"><strong>Description</strong><div>{ticket.description}</div></div>
        <div><strong>Created</strong><div>{new Date(ticket.createdAt).toLocaleString()}</div></div>
      </div>

      <ActionsTaken ticketId={ticket.id} readOnly />

      <StatusHistory ticketId={ticket.id} />

      <div className="card p-3 mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h3 className="h5 mb-0">Public Comments</h3>
          {ticket.requesterResolvedAt ? (
            <span className="small text-success" role="status">
              You marked this as appearing resolved on{" "}
              {new Date(ticket.requesterResolvedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
              IT Staff will confirm.
            </span>
          ) : (
            !["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.currentStatus) && (
              <button type="button" className="btn btn-sm btn-outline-success" onClick={handleAppearsResolved} disabled={flagging}>
                Problem Appears Resolved
              </button>
            )
          )}
        </div>
        {flagError && <div className="text-danger small mb-2" role="alert">{flagError}</div>}

        <ul className="list-group mb-3">
          {(ticket.publicComments ?? []).map((comment) => (
            <li key={comment.id} className="list-group-item">
              <div>{comment.content}</div>
              <small className="text-muted">{new Date(comment.createdAt).toLocaleString()}</small>
            </li>
          ))}
          {(ticket.publicComments ?? []).length === 0 && <li className="list-group-item text-muted">No public comments yet.</li>}
        </ul>

        <form onSubmit={handleCommentSubmit}>
          <textarea
            className="form-control mb-2"
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            aria-label="Add a public comment"
            placeholder="Add a public update for the support team"
          />
          {commentError && <div className="text-danger small mb-2" role="alert">{commentError}</div>}
          <button type="submit" className="btn btn-success" disabled={postingComment}>{postingComment ? "Posting…" : "Post Comment"}</button>
        </form>
      </div>

      <AttachmentSection ticketId={ticket.id} attachments={ticket.attachments} onChange={load} />
    </div>
  );
}