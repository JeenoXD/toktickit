// Lab 4 IT Staff / Administrator dashboard (ui-spec.md Section 3, specification.md BR-23, BR-24).
import { useEffect, useState } from "react";
import { fetchStaffDashboard, ListFilters, ListView, StaffDashboardData } from "./api.js";
import { DashboardError, DashboardSkeleton, formatShort, MetricCard, Panel, TicketList } from "./DashboardParts";
import SystemStatus from "./SystemStatus";
import { PRIORITY_LABELS, statusLabel } from "./statusLabels";

interface Props {
  userName: string;
  isAdmin: boolean;
  onOpenList: (view: ListView, filters: ListFilters) => void;
  onOpenTicket: (id: number) => void;
  onOpenUsers?: () => void;
}

export default function StaffDashboard({ userName, isAdmin, onOpenList, onOpenTicket, onOpenUsers }: Props) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");

  async function load() {
    setState("loading");
    try {
      setData(await fetchStaffDashboard());
      setState("ready");
    } catch (err) {
      setState((err as { status?: number }).status === 403 ? "forbidden" : "error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const open = (m: { drillDown: { view: ListView; filters: ListFilters } }) => () => onOpenList(m.drillDown.view, m.drillDown.filters);

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Welcome back, {userName}!</h1>
          <p className="text-muted mb-0">Here's what's happening with the service desk today.</p>
        </div>
        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => void load()} disabled={state === "loading"}>
          {state === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {state === "loading" && !data && <DashboardSkeleton />}
      {state === "error" && <DashboardError onRetry={() => void load()} />}
      {state === "forbidden" && <div className="alert alert-danger">You do not have access to the staff dashboard.</div>}

      {data && state !== "forbidden" && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-xl">
              <MetricCard label="Unassigned" count={data.metrics.unassigned.count} onOpen={open(data.metrics.unassigned)} hint="Active, no owner" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <MetricCard label="My Assigned" count={data.metrics.myAssigned.count} onOpen={open(data.metrics.myAssigned)} hint="Active, owned by me" />
            </div>
            <div className="col-6 col-md-4 col-xl">
              <MetricCard label="Waiting for Requester" count={data.metrics.waitingForRequester.count} onOpen={open(data.metrics.waitingForRequester)} />
            </div>
            <div className="col-6 col-md-6 col-xl">
              <MetricCard
                label="Appears Resolved"
                count={data.metrics.appearsResolved.count}
                onOpen={open(data.metrics.appearsResolved)}
                hint={data.metrics.appearsResolved.count > 0 ? "Needs review" : "Requester flags"}
                highlight={data.metrics.appearsResolved.count > 0}
              />
            </div>
            <div className="col-12 col-md-6 col-xl">
              <MetricCard label="My Planned Actions" count={data.metrics.myPlannedActions.count} hint="Actions I still need to do" />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-6">
              <Panel
                title="Urgent (High priority)"
                action={
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onOpenList("ticketQueue", { statusGroup: "active", itPriority: "HIGH" })}>
                    View all
                  </button>
                }
              >
                <TicketList tickets={data.urgent} empty="No urgent tickets right now." onOpenTicket={onOpenTicket} showOwner />
              </Panel>
            </div>
            <div className="col-12 col-lg-6">
              <Panel
                title="Recently Updated"
                action={
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onOpenList("ticketQueue", { statusGroup: "active" })}>
                    View all
                  </button>
                }
              >
                <TicketList tickets={data.recentlyUpdated} empty="No active tickets." onOpenTicket={onOpenTicket} showOwner />
              </Panel>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-6">
              <Panel title="My Planned Actions">
                {data.metrics.myPlannedActions.items.length === 0 ? (
                  <p className="text-muted small mb-0">You have no planned actions.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {data.metrics.myPlannedActions.items.map((a) => (
                      <li key={a.actionId} className="border-bottom">
                        <button type="button" className="btn btn-link text-start text-decoration-none w-100 px-0 py-2" onClick={() => onOpenTicket(a.ticketId)}>
                          <span className="d-block small fw-semibold" style={{ color: "#006B3C" }}>{a.ticketNumber}</span>
                          <span className="d-block text-body text-truncate" title={a.description}>{a.description}</span>
                          <span className="d-block small text-muted">Planned for {formatShort(a.actionAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {data.metrics.myFollowUps.count > 0 && (
                  <p className="small mt-2 mb-0">
                    <span className="badge bg-warning text-dark me-1">Follow-up</span>
                    {data.metrics.myFollowUps.count === 1
                      ? "1 completed action still needs follow-up."
                      : `${data.metrics.myFollowUps.count} completed actions still need follow-up.`}
                  </p>
                )}
              </Panel>
            </div>
            <div className="col-12 col-lg-6">
              <Panel title="Tickets by Status">
                <div className="row g-1">
                  {Object.entries(data.byStatus).map(([status, count]) => (
                    <div key={status} className="col-6">
                      <button
                        type="button"
                        className="btn btn-light btn-sm w-100 h-100 d-flex justify-content-between align-items-center gap-2 text-start"
                        onClick={() => onOpenList("ticketQueue", { status })}
                        aria-label={`${statusLabel(status)}: ${count} tickets, view list`}
                      >
                        <span>{statusLabel(status)}</span>
                        <strong>{count}</strong>
                      </button>
                    </div>
                  ))}
                </div>
                <h3 className="h6 mt-3 mb-2">Active Tickets by IT Priority</h3>
                <div className="row g-1">
                  {(["HIGH", "MEDIUM", "LOW", "UNSET"] as const).map((p) => (
                    <div key={p} className="col-6 col-sm-3">
                      <button
                        type="button"
                        className="btn btn-light btn-sm w-100 h-100 d-flex justify-content-between align-items-center gap-2 text-start"
                        onClick={() => onOpenList("ticketQueue", { statusGroup: "active", itPriority: p })}
                        aria-label={`${p === "UNSET" ? "Not set" : PRIORITY_LABELS[p]} priority: ${data.byItPriority[p]} tickets, view list`}
                      >
                        <span>{p === "UNSET" ? "Not set" : PRIORITY_LABELS[p]}</span>
                        <strong>{data.byItPriority[p]}</strong>
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <button type="button" className="card p-3 w-100 text-start metric-card" onClick={() => onOpenList("ticketQueue", { statusGroup: "active", owner: "me" })}>
                <span className="fw-semibold" style={{ color: "#006B3C" }}>My Queue</span>
                <span className="small text-muted">Active tickets assigned to me</span>
              </button>
            </div>
            <div className="col-12 col-md-6">
              <button type="button" className="card p-3 w-100 text-start metric-card" onClick={() => onOpenList("ticketQueue", {})}>
                <span className="fw-semibold" style={{ color: "#006B3C" }}>Search All Tickets</span>
                <span className="small text-muted">Open the full queue with search and filters</span>
              </button>
            </div>
          </div>

          {isAdmin && data.users && (
            <div className="row g-3 mb-4">
              <div className="col-12 col-lg-6">
                <Panel
                  title="User Accounts"
                  action={
                    onOpenUsers && (
                      <button type="button" className="btn btn-link btn-sm p-0" onClick={onOpenUsers}>
                        Manage users
                      </button>
                    )
                  }
                >
                  <dl className="row small mb-0">
                    <dt className="col-8">Active Requesters</dt>
                    <dd className="col-4 text-end">{data.users.active.REQUESTER}</dd>
                    <dt className="col-8">Active IT Staff</dt>
                    <dd className="col-4 text-end">{data.users.active.IT_STAFF}</dd>
                    <dt className="col-8">Active Administrators</dt>
                    <dd className="col-4 text-end">{data.users.active.ADMINISTRATOR}</dd>
                    <dt className="col-8">Inactive accounts</dt>
                    <dd className="col-4 text-end">{data.users.inactive}</dd>
                  </dl>
                </Panel>
              </div>
              <div className="col-12 col-lg-6">
                <SystemStatus />
              </div>
            </div>
          )}

          <p className="small text-muted mb-0">Updated {formatShort(data.generatedAt)}</p>
        </>
      )}
    </div>
  );
}
