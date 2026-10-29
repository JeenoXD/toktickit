import { useEffect, useState } from "react";
import { fetchTickets, fetchCategories, Category, Ticket } from "./api.js";
import { useAuth } from "./AuthContext.js";
import { useRequester } from "./RequesterContext.js";
import { PRIORITY_LABELS, StatusBadge } from "./statusLabels";

type ListState = "loading" | "success" | "empty" | "no-results" | "error";

export default function MyTickets({
  onSelectTicket,
  initialFilters = {},
}: {
  onSelectTicket: (id: number) => void;
  /** Lab 4 dashboard drill-down: { status } or { statusGroup: "active" }. */
  initialFilters?: Record<string, string>;
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

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<ListState>("loading");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    initialFilters.statusGroup === "active" ? "active" : initialFilters.status ?? "",
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hadFilters, setHadFilters] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setState("loading");
    const filtersApplied = Boolean(search || categoryFilter || priorityFilter || statusFilter);
    setHadFilters(filtersApplied);

    fetchTickets({
      search: search || undefined,
      category: categoryFilter ? Number(categoryFilter) : undefined,
      requestedPriority: priorityFilter || undefined,
      status: statusFilter && statusFilter !== "active" ? statusFilter : undefined,
      statusGroup: statusFilter === "active" ? "active" : undefined,
      page,
    })
      .then((result) => {
        setTickets(result.data);
        setTotalPages(result.pagination.totalPages);
        if (result.data.length === 0) {
          setState(filtersApplied ? "no-results" : "empty");
        } else {
          setState("success");
        }
      })
      .catch(() => setState("error"));
    // Depend on the id, not the object: `user` is rebuilt on every render when it comes
    // from RequesterContext, which would otherwise refetch after every response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, search, categoryFilter, priorityFilter, statusFilter, page]);

  if (!user) {
    return <p>You must sign in to view your tickets.</p>;
  }

  return (
    <div className="container py-4">
      <h2>My Tickets</h2>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Search by ticket number or summary"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          aria-label="Status"
          className="form-select"
          style={{ maxWidth: 220 }}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="active">Open tickets (not finished)</option>
          <option value="NEW">New</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <button
          className="btn btn-outline-secondary"
          onClick={() => { setSearch(""); setCategoryFilter(""); setPriorityFilter(""); setStatusFilter(""); setPage(1); }}
        >
          Clear Filters
        </button>
      </div>

      {state === "loading" && <p>Loading tickets…</p>}
      {state === "error" && <p className="text-danger">Unable to load your tickets. Please try again.</p>}
      {state === "empty" && (
        <div className="alert alert-success">You have no tickets yet. Create your first ticket to get started.</div>
      )}
      {state === "no-results" && (
        <div className="alert alert-warning">No tickets match your current search or filters.</div>
      )}

      {state === "success" && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Ticket No.</th>
                <th>Summary</th>
                <th>Requested Priority</th>
                <th>Current Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
            {tickets.map((t) => (
                <tr key={t.id} onClick={() => onSelectTicket(t.id)} style={{ cursor: "pointer" }}>
                <td>{t.ticketNumber}</td>
                <td>{t.summary}</td>
                <td><span className="badge bg-secondary">{PRIORITY_LABELS[t.requestedPriority] ?? t.requestedPriority}</span></td>
                <td><StatusBadge status={t.currentStatus} /></td>
                <td>{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
            ))}
            </tbody>
          </table>

          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}