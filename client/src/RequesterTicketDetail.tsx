import { useEffect, useState } from "react";
import { fetchTicketDetail, TicketDetail } from "./api.js";
import { useRequester } from "./RequesterContext";
import AttachmentSection from "./AttachmentSection";

type LoadState = "loading" | "success" | "error";

export default function RequesterTicketDetail({ ticketId }: { ticketId: number }) {
  const { requester } = useRequester();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  function load() {
    if (!requester) return;
    setState("loading");
    fetchTicketDetail(ticketId, requester.id)
      .then((t) => {
        setTicket(t);
        setState("success");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, [ticketId, requester]);

  if (state === "loading") return <p>Loading ticket…</p>;
  if (state === "error" || !ticket) return <p className="text-danger">Unable to load this ticket.</p>;

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h2>Ticket {ticket.ticketNumber}</h2>

      <div className="card p-3 mb-3" style={{ background: "#F0F1EE" }}>
        <div className="row mb-2">
          <div className="col-6"><strong>Requested Priority</strong><div>{ticket.requestedPriority}</div></div>
          <div className="col-6"><strong>Current Status</strong><div>{ticket.currentStatus}</div></div>
        </div>
        <div className="mb-2"><strong>Summary</strong><div>{ticket.summary}</div></div>
        <div className="mb-2"><strong>Description</strong><div>{ticket.description}</div></div>
        <div><strong>Created</strong><div>{new Date(ticket.createdAt).toLocaleString()}</div></div>
      </div>

      <AttachmentSection ticketId={ticket.id} attachments={ticket.attachments} onChange={load} />
    </div>
  );
}