import { useEffect, useState } from "react";
import { ListFilters, ListView } from "./api.js";
import { useRequester, RequesterProvider } from "./RequesterContext.js";
import { AuthProvider, useAuth } from "./AuthContext.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import RequesterTicketDetail from "./RequesterTicketDetail.js";
import ITTicketQueue from "./ITTicketQueue";
import ITStaffTicketDetail from "./ITStaffTicketDetail";
import UserManagement from "./UserManagement";
import StaffDashboard from "./StaffDashboard";
import RequesterDashboard from "./RequesterDashboard";

type View = "dashboard" | "createTicket" | "myTickets" | "ticketDetail" | "ticketQueue" | "userManagement";

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  createTicket: "Create Ticket",
  myTickets: "My Tickets",
  ticketDetail: "Ticket",
  ticketQueue: "Ticket Queue",
  userManagement: "User Management",
};

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function AppShell() {
  const { user, logout } = useAuth();
  const { requester, setRequester } = useRequester();
  // Lab 4 FR-11: the dashboard is the landing screen for every role.
  const [view, setView] = useState<View>("dashboard");
  const [returnView, setReturnView] = useState<View>("dashboard");
  const [listFilters, setListFilters] = useState<ListFilters>({});
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Requester identity comes from the authenticated session (Lab 3).
  useEffect(() => {
    if (user && user.role === "REQUESTER" && !requester) {
      setRequester({ id: user.id, name: user.name, email: user.email });
    }
  }, [user, requester, setRequester]);

  function navigate(next: View, filters: ListFilters = {}) {
    setListFilters(filters);
    setView(next);
  }

  function goToTicket(id: number) {
    setReturnView(view === "ticketDetail" ? returnView : view);
    setSelectedTicketId(id);
    setView("ticketDetail");
  }

  function openList(target: ListView, filters: ListFilters) {
    navigate(target, filters);
  }

  const isRequester = user?.role === "REQUESTER";
  const isStaffOrAdmin = user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR";
  const isAdmin = user?.role === "ADMINISTRATOR";

  const navItems: View[] = isRequester
    ? ["dashboard", "myTickets", "createTicket"]
    : isAdmin
      ? ["dashboard", "ticketQueue", "userManagement"]
      : ["dashboard", "ticketQueue"];

  // The detail screen belongs to the list it was opened from, for the active indicator.
  const activeNav = view === "ticketDetail" ? returnView : view;
  const listKey = JSON.stringify(listFilters);

  return (
    <div>
      <nav className="navbar px-3 gap-2" style={{ background: "#006B3C" }} aria-label="Main">
        <h1 className="navbar-brand text-white h5 mb-0">TokTickIT</h1>
        <ul className="navbar-nav flex-row flex-wrap gap-1 me-auto">
          {navItems.map((item) => (
            <li key={item} className="nav-item">
              <button
                type="button"
                className={`btn btn-sm nav-tab ${activeNav === item ? "active" : ""}`}
                aria-current={activeNav === item ? "page" : undefined}
                onClick={() => navigate(item)}
              >
                {VIEW_LABELS[item]}
              </button>
            </li>
          ))}
        </ul>
        <div className="d-flex flex-wrap align-items-center gap-2 text-white">
          <span>{user?.name}</span>
          <span className="badge bg-light text-dark" title={ROLE_LABELS[user?.role ?? ""]}>{user?.role}</span>
          <button className="btn btn-sm btn-outline-light" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </nav>

      <main>
        {view === "dashboard" && isRequester && user && (
          <RequesterDashboard
            userName={user.name}
            onOpenList={openList}
            onOpenTicket={goToTicket}
            onCreateTicket={() => navigate("createTicket")}
          />
        )}
        {view === "dashboard" && isStaffOrAdmin && user && (
          <StaffDashboard
            userName={user.name}
            isAdmin={isAdmin}
            onOpenList={openList}
            onOpenTicket={goToTicket}
            onOpenUsers={isAdmin ? () => navigate("userManagement") : undefined}
          />
        )}
        {isRequester && view === "createTicket" && <CreateTicket />}
        {isRequester && view === "myTickets" && <MyTickets key={listKey} onSelectTicket={goToTicket} initialFilters={listFilters} />}
        {isStaffOrAdmin && view === "ticketQueue" && <ITTicketQueue key={listKey} onSelectTicket={goToTicket} initialFilters={listFilters} />}
        {isAdmin && view === "userManagement" && <UserManagement />}
        {view === "ticketDetail" && selectedTicketId && (
          <div className="p-3">
            <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setView(returnView)}>
              ← Back to {VIEW_LABELS[returnView]}
            </button>
            {isRequester && <RequesterTicketDetail ticketId={selectedTicketId} />}
            {isStaffOrAdmin && <ITStaffTicketDetail ticketId={selectedTicketId} />}
          </div>
        )}
      </main>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-center mt-5">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="container py-5" style={{ maxWidth: 420 }}>
        <Login />
      </div>
    );
  }

  if (user.requiresPasswordChange) {
    return (
      <div className="container py-5" style={{ maxWidth: 420 }}>
        <ChangePassword />
      </div>
    );
  }

  return (
    <RequesterProvider>
      <AppShell />
    </RequesterProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}