import { useEffect, useMemo, useState } from "react";
import { fetchTicketQueue, TicketQueueEntry } from "./api.js";

type QueueState = "loading" | "success" | "empty" | "no-results" | "forbidden" | "error";

const EXTRA_FILTER_LABELS: Record<string, Record<string, string>> = {
  owner: { me: "Assigned to me", unassigned: "Unassigned" },
  appearsResolved: { true: "Requester says resolved" },
};

export default function ITTicketQueue({
  onSelectTicket,
  initialFilters = {},
}: {
  onSelectTicket: (id: number) => void;
  /** Lab 4 dashboard drill-down filters (status, statusGroup, itPriority, owner, appearsResolved). */
  initialFilters?: Record<string, string>;
}) {
  const [tickets, setTickets] = useState<TicketQueueEntry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    initialFilters.statusGroup === "active" && !initialFilters.status ? "active" : initialFilters.status ?? "",
  );
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.itPriority ?? "");
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>(() => {
    const extras: Record<string, string> = {};
    if (initialFilters.owner) extras.owner = initialFilters.owner;
    if (initialFilters.appearsResolved) extras.appearsResolved = initialFilters.appearsResolved;
    return extras;
  });
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "itPriority">("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<QueueState>("loading");

  const filtersApplied = useMemo(
    () => Boolean(search || statusFilter || priorityFilter || Object.keys(extraFilters).length),
    [search, statusFilter, priorityFilter, extraFilters],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await fetchTicketQueue({
          search: search || undefined,
          status: statusFilter && statusFilter !== "active" ? statusFilter : undefined,
          statusGroup: statusFilter === "active" ? "active" : undefined,
          itPriority: priorityFilter || undefined,
          owner: extraFilters.owner,
          appearsResolved: extraFilters.appearsResolved,
          sortBy,
          sortDir,
          page,
          pageSize,
        });

        if (cancelled) return;

        setTickets(result.data);
        setTotalPages(result.pagination.totalPages || 1);
        setState(result.data.length === 0 ? (filtersApplied ? "no-results" : "empty") : "success");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        setState(message.toLowerCase().includes("forbidden") ? "forbidden" : "error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, priorityFilter, extraFilters, sortBy, sortDir, page, pageSize, filtersApplied]);

  function toggleSort(nextSortBy: "createdAt" | "updatedAt" | "itPriority") {
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("desc");
  }

  const renderBadge = (value: string | null | undefined, variant: "info" | "success" | "warning" | "secondary") => (
    <span className={`badge bg-${variant} text-dark`}>{value ?? "Unassigned"}</span>
  );

  return (
    <div className="container py-4">
      <h2>Ticket Queue</h2>

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <input
          aria-label="Search"
          className="form-control"
          style={{ maxWidth: 280 }}
          placeholder="Search by ticket number or summary"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />

        <label className="d-flex align-items-center gap-2 mb-0">
          <span>Status</span>
          <select aria-label="Status" className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="active">Active (not finished)</option>
            <option value="NEW">New</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>

        <label className="d-flex align-items-center gap-2 mb-0">
          <span>IT Priority</span>
          <select aria-label="IT Priority" className="form-select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="UNSET">Not set</option>
          </select>
        </label>

        <button className="btn btn-outline-secondary" onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setExtraFilters({}); setPage(1); }}>
          Clear
        </button>
      </div>

      {Object.keys(extraFilters).length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3" aria-label="Dashboard filters">
          {Object.entries(extraFilters).map(([key, value]) => {
            const label = EXTRA_FILTER_LABELS[key]?.[value] ?? `${key}: ${value}`;
            return (
              <button
                key={key}
                type="button"
                className="btn btn-sm btn-outline-success rounded-pill"
                aria-label={`Remove filter: ${label}`}
                onClick={() => {
                  setExtraFilters((current) => {
                    const next = { ...current };
                    delete next[key];
                    return next;
                  });
                  setPage(1);
                }}
              >
                {label} <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      )}

      {state === "loading" && <p>Loading queue…</p>}
      {state === "forbidden" && <div className="alert alert-danger">You are not allowed to view the ticket queue.</div>}
      {state === "error" && <div className="alert alert-danger">Unable to load the ticket queue. Please try again.</div>}
      {state === "empty" && <div className="alert alert-info">No tickets have been created yet.</div>}
      {state === "no-results" && <div className="alert alert-warning">No tickets match your current filters.</div>}

      {state === "success" && (
        <>
          <div className="table-responsive d-none d-lg-block">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("createdAt")} style={{ cursor: "pointer" }}>Created</th>
                  <th onClick={() => toggleSort("updatedAt")} style={{ cursor: "pointer" }}>Updated</th>
                  <th>Ticket #</th>
                  <th>Summary</th>
                  <th>Requester</th>
                  <th>Owner</th>
                  <th onClick={() => toggleSort("itPriority")} style={{ cursor: "pointer" }}>IT Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(ticket.updatedAt).toLocaleDateString()}</td>
                    <td>{ticket.ticketNumber}</td>
                    <td>{ticket.summary}</td>
                    <td>{ticket.requesterName}</td>
                    <td>{renderBadge(ticket.ownerName, "secondary")}</td>
                    <td>{renderBadge(ticket.itPriority ?? "Unassigned", "warning")}</td>
                    <td>{renderBadge(ticket.currentStatus, "info")}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => onSelectTicket(ticket.id)}>
                        Open Ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-lg-none">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="card mb-2">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>{ticket.ticketNumber}</strong>
                    {renderBadge(ticket.currentStatus, "info")}
                  </div>
                  <div className="mb-2">{ticket.summary}</div>
                  <div className="small text-muted mb-1">Requester: {ticket.requesterName}</div>
                  <div className="small text-muted mb-1">Owner: {ticket.ownerName ?? "Unassigned"}</div>
                  <div className="mb-2">{renderBadge(ticket.itPriority ?? "Unassigned", "warning")}</div>
                  <button className="btn btn-sm btn-primary" onClick={() => onSelectTicket(ticket.id)}>
                    Open Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
