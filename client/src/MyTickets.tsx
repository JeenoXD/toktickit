import { useEffect, useState } from "react";
import { fetchTickets, fetchCategories, Category, Ticket } from "./api.js";
import { useRequester } from "./RequesterContext";

type ListState = "loading" | "success" | "empty" | "no-results" | "error";

export default function MyTickets() {
  const { requester } = useRequester();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<ListState>("loading");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hadFilters, setHadFilters] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!requester) return;
    setState("loading");
    const filtersApplied = Boolean(search || categoryFilter || priorityFilter);
    setHadFilters(filtersApplied);

    fetchTickets({
      requesterId: requester.id,
      search: search || undefined,
      category: categoryFilter ? Number(categoryFilter) : undefined,
      requestedPriority: priorityFilter || undefined,
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
  }, [requester, search, categoryFilter, priorityFilter, page]);

  if (!requester) {
    return <p>Select a Development Requester to view your tickets.</p>;
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
          onClick={() => { setSearch(""); setCategoryFilter(""); setPriorityFilter(""); setPage(1); }}
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
                <tr key={t.id}>
                  <td>{t.ticketNumber}</td>
                  <td>{t.summary}</td>
                  <td><span className="badge bg-secondary">{t.requestedPriority}</span></td>
                  <td><span className="badge bg-info text-dark">{t.currentStatus}</span></td>
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