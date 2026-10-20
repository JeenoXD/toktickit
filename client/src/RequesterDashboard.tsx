// Lab 4 Requester dashboard (ui-spec.md Section 4, specification.md BR-22).
import { useEffect, useState } from "react";
import { fetchRequesterDashboard, ListFilters, ListView, RequesterDashboardData } from "./api.js";
import { DashboardError, DashboardSkeleton, MetricCard, Panel, TicketList } from "./DashboardParts";

interface Props {
  userName: string;
  onOpenList: (view: ListView, filters: ListFilters) => void;
  onOpenTicket: (id: number) => void;
  onCreateTicket: () => void;
}

export default function RequesterDashboard({ userName, onOpenList, onOpenTicket, onCreateTicket }: Props) {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    setState("loading");
    try {
      setData(await fetchRequesterDashboard());
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const m = data?.metrics;
  const open = (metric: { drillDown: { view: ListView; filters: ListFilters } }) => () =>
    onOpenList(metric.drillDown.view, metric.drillDown.filters);
  const hasNoTickets = m && m.openTickets.count + m.resolved.count + m.closed.count === 0 && data!.recentlyUpdated.length === 0;

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Welcome, {userName}!</h1>
          <p className="text-muted mb-0">Here's the latest on your requests.</p>
        </div>
        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => void load()} disabled={state === "loading"}>
          {state === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {state === "loading" && !data && <DashboardSkeleton />}
      {state === "error" && <DashboardError onRetry={() => void load()} />}

      {data && m && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <MetricCard label="My Open Tickets" count={m.openTickets.count} onOpen={open(m.openTickets)} />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard
                label="Waiting for Me"
                count={m.waitingForMe.count}
                onOpen={open(m.waitingForMe)}
                hint={m.waitingForMe.count > 0 ? "Needs your reply" : undefined}
                highlight={m.waitingForMe.count > 0}
              />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard label="Resolved" count={m.resolved.count} onOpen={open(m.resolved)} />
            </div>
            <div className="col-6 col-lg-3">
              <MetricCard label="Closed" count={m.closed.count} onOpen={open(m.closed)} />
            </div>
          </div>

          {hasNoTickets ? (
            <div className="card p-4 text-center mb-4">
              <p className="mb-3">You haven't submitted any tickets yet.</p>
              <div>
                <button type="button" className="btn btn-success" onClick={onCreateTicket}>Create Ticket</button>
              </div>
            </div>
          ) : (
            <div className="row g-3 mb-4">
              <div className="col-12 col-lg-6">
                <Panel
                  title="My Recent Tickets"
                  action={
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onOpenList("myTickets", {})}>
                      View all
                    </button>
                  }
                >
                  <TicketList tickets={data.recentlyUpdated} empty="No recent updates." onOpenTicket={onOpenTicket} />
                </Panel>
              </div>
              <div className="col-12 col-lg-6">
                <Panel title="Recently Resolved (last 7 days)">
                  <TicketList
                    tickets={data.recentlyResolved}
                    empty="Nothing resolved in the last 7 days."
                    onOpenTicket={onOpenTicket}
                    timeField="resolvedAt"
                  />
                </Panel>
              </div>
            </div>
          )}

          {!hasNoTickets && (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <button type="button" className="card p-3 w-100 text-start metric-card" onClick={onCreateTicket}>
                <span className="fw-semibold" style={{ color: "#006B3C" }}>+ Create Ticket</span>
                <span className="small text-muted">Submit a new request</span>
              </button>
            </div>
            <div className="col-12 col-md-6">
              <button type="button" className="card p-3 w-100 text-start metric-card" onClick={() => onOpenList("myTickets", {})}>
                <span className="fw-semibold" style={{ color: "#006B3C" }}>View My Tickets</span>
                <span className="small text-muted">Track existing requests</span>
              </button>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
