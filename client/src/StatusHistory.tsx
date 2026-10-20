// Lab 4 status history timeline (BR-18), shown on both Ticket Detail screens.
import { useEffect, useState } from "react";
import { fetchStatusHistory, StatusHistoryEntry } from "./api.js";
import { statusLabel } from "./statusLabels";

export default function StatusHistory({ ticketId, refreshKey = 0 }: { ticketId: number; refreshKey?: number }) {
  const [entries, setEntries] = useState<StatusHistoryEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchStatusHistory(ticketId)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [ticketId, refreshKey]);

  return (
    <section className="card p-3 mb-4" aria-labelledby={`history-title-${ticketId}`}>
      <h3 id={`history-title-${ticketId}`} className="h5 mb-3">Status History</h3>
      {state === "loading" && <p className="text-muted mb-0">Loading history…</p>}
      {state === "error" && <p className="text-danger mb-0">Status history could not be loaded.</p>}
      {state === "ready" && entries.length === 0 && <p className="text-muted mb-0">No status changes recorded.</p>}
      {state === "ready" && entries.length > 0 && (
        <ol className="list-unstyled mb-0">
          {entries.map((h) => (
            <li key={h.id} className="d-flex flex-wrap gap-2 py-1 border-bottom small">
              <span className="text-muted" style={{ minWidth: 150 }}>
                {new Date(h.changedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>
                {h.fromStatus ? (
                  <>
                    {statusLabel(h.fromStatus)} <span aria-hidden="true">→</span>
                    <span className="visually-hidden"> to </span> <strong>{statusLabel(h.toStatus)}</strong>
                  </>
                ) : (
                  <>Created as <strong>{statusLabel(h.toStatus)}</strong></>
                )}
              </span>
              <span className="text-muted">by {h.changedBy.name}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
