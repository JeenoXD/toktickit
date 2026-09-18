import { useEffect, useState } from "react";
import { checkSystem, Category } from "./api.js";
import { useRequester, RequesterProvider } from "./RequesterContext.js";
import { AuthProvider, useAuth } from "./AuthContext.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import RequesterTicketDetail from "./RequesterTicketDetail.js";
import ITTicketQueue from "./ITTicketQueue";

type UiState = "idle" | "loading" | "success" | "error";
type View = "checkSystem" | "createTicket" | "myTickets" | "ticketDetail" | "ticketQueue";

function TicketDeskApp() {
  const [state, setState] = useState<UiState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    setErrorMsg(null);

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg("Unable to connect to TokTickIT API");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button
        className="btn btn-success"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <>
          <p className="mt-3">
            System Status: <strong>Online</strong>
          </p>

          <ul className="list-group">
            {categories.map((c) => (
              <li key={c.id} className="list-group-item">
                {c.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {state === "error" && (
        <p className="mt-3 text-danger">
          System Status: Offline — {errorMsg}
        </p>
      )}
    </div>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const { requester, setRequester } = useRequester();
  const [view, setView] = useState<View>("checkSystem");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Requester identity now comes from the authenticated session, not a manual
  // selector. This keeps Lab 2's RequesterContext-driven ticket screens working
  // unchanged until Issue 3 switches the API layer itself to req.user.id.
  useEffect(() => {
    if (user && user.role === "REQUESTER" && !requester) {
      setRequester({ id: user.id, name: user.name, email: user.email });
    }
  }, [user, requester, setRequester]);

  function goToTicket(id: number) {
    setSelectedTicketId(id);
    setView("ticketDetail");
  }

  const isRequester = user?.role === "REQUESTER";
  const isStaffOrAdmin = user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR";

  return (
    <div>
      <nav className="navbar px-3" style={{ background: "#006B3C" }}>
        <span className="navbar-brand text-white">TokTickIT</span>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-light" onClick={() => setView("checkSystem")}>
            System Check
          </button>
          {isRequester && (
            <>
              <button className="btn btn-sm btn-outline-light" onClick={() => setView("createTicket")}>
                Create Ticket
              </button>
              <button className="btn btn-sm btn-outline-light" onClick={() => setView("myTickets")}>
                My Tickets
              </button>
            </>
          )}
          {isStaffOrAdmin && (
            <button className="btn btn-sm btn-outline-light" onClick={() => setView("ticketQueue")}>
              Ticket Queue
            </button>
          )}

          <span className="text-white ms-3">
            {user?.name}
            <span className="badge bg-light text-dark ms-2">{user?.role}</span>
            <button className="btn btn-sm btn-outline-light ms-2" onClick={() => logout()}>
              Logout
            </button>
          </span>
        </div>
      </nav>

      {view === "checkSystem" && <TicketDeskApp />}
      {isRequester && view === "createTicket" && <CreateTicket />}
      {isRequester && view === "myTickets" && <MyTickets onSelectTicket={goToTicket} />}
      {isStaffOrAdmin && view === "ticketQueue" && <ITTicketQueue onSelectTicket={goToTicket} />}
      {isRequester && view === "ticketDetail" && selectedTicketId && (
        <div className="p-3">
          <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setView("myTickets")}>
            ← Back to My Tickets
          </button>
          <RequesterTicketDetail ticketId={selectedTicketId} />
        </div>
      )}
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