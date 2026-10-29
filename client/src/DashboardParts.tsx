// Shared building blocks for the Lab 4 dashboards (docs/lab-04/ui-spec.md Sections 3 and 4).
import { ReactNode } from "react";
import { DashboardTicket } from "./api.js";
import { StatusBadge } from "./statusLabels";

export function formatShort(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** One metric card. The whole card is one button with a descriptive accessible name. */
export function MetricCard({
  label,
  count,
  onOpen,
  hint,
  highlight = false,
}: {
  label: string;
  count: number;
  onOpen?: () => void;
  hint?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <div className="small text-muted">{label}</div>
      <div className="display-6 fw-semibold" style={{ color: "#006B3C" }}>{count}</div>
      {hint && <div className={`small ${highlight ? "text-danger fw-semibold" : "text-muted"}`}>{hint}</div>}
      {onOpen && <div className="small text-success mt-1">View all</div>}
    </>
  );
  const style = { minHeight: 120, borderColor: highlight ? "#D32F2F" : undefined };
  if (!onOpen) {
    return (
      <div className="card p-3 h-100" style={style}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="card p-3 h-100 w-100 text-start metric-card"
      style={style}
      onClick={onOpen}
      aria-label={`${label}: ${count}, view list`}
    >
      {body}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="card p-3 h-100" aria-labelledby={id}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h2 id={id} className="h6 mb-0">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TicketList({
  tickets,
  empty,
  onOpenTicket,
  showOwner = false,
  timeField = "updatedAt",
}: {
  tickets: DashboardTicket[];
  empty: string;
  onOpenTicket: (id: number) => void;
  showOwner?: boolean;
  timeField?: "updatedAt" | "resolvedAt";
}) {
  if (tickets.length === 0) return <p className="text-muted small mb-0">{empty}</p>;
  return (
    <ul className="list-unstyled mb-0">
      {tickets.map((t) => (
        <li key={t.id} className="border-bottom">
          <button
            type="button"
            className="btn btn-link text-start text-decoration-none w-100 px-0 py-2 d-flex flex-wrap gap-2 justify-content-between align-items-center"
            onClick={() => onOpenTicket(t.id)}
          >
            <span style={{ minWidth: 0, flex: "1 1 200px" }}>
              <span className="d-block small fw-semibold" style={{ color: "#006B3C" }}>{t.ticketNumber}</span>
              <span className="d-block text-body text-truncate" title={t.summary}>{t.summary}</span>
              {showOwner && (
                <span className="d-block small text-muted">{t.owner ? `Owner: ${t.owner.name}` : "Unassigned"}</span>
              )}
            </span>
            <span className="d-flex align-items-center gap-2">
              <StatusBadge status={t.currentStatus} />
              <span className="small text-muted text-nowrap">
                {formatShort((timeField === "resolvedAt" ? t.resolvedAt : t.updatedAt) ?? t.updatedAt)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="row g-3 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="col-6 col-lg-3">
            <div className="card p-3 placeholder-glow" style={{ minHeight: 120 }}>
              <span className="placeholder col-6 mb-2" />
              <span className="placeholder col-3" style={{ height: 32 }} />
            </div>
          </div>
        ))}
      </div>
      <p className="visually-hidden">Loading dashboard…</p>
    </div>
  );
}

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="alert alert-danger d-flex flex-wrap gap-2 align-items-center" role="alert">
      <span>Dashboard could not be loaded.</span>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>
    </div>
  );
}
