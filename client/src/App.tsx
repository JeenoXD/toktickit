import { useEffect, useState } from "react";
import { checkSystem, Category } from "./api.js";
import { useRequester, RequesterProvider } from "./RequesterContext.js";
import RequesterSelection from "./RequesterSelection.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";
type View = "checkSystem" | "createTicket" | "myTickets";

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
  const { requester, setRequester } = useRequester();
  const [showSelector, setShowSelector] = useState(false);
  const [view, setView] = useState<View>("checkSystem");

  return (
    <div>
      <nav className="navbar px-3" style={{ background: "#006B3C" }}>
        <span className="navbar-brand text-white">IT Service Desk</span>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-light" onClick={() => setView("checkSystem")}>
            System Check
          </button>
          <button className="btn btn-sm btn-outline-light" onClick={() => setView("createTicket")}>
            Create Ticket
          </button>
          <button className="btn btn-sm btn-outline-light" onClick={() => setView("myTickets")}>
            My Tickets
          </button>

          {requester ? (
            <span className="text-white ms-3">
              {requester.name}{" "}
              <button
                className="btn btn-sm btn-outline-light ms-2"
                onClick={() => {
                  setRequester(null);
                  setShowSelector(true);
                }}
              >
                Change Requester
              </button>
            </span>
          ) : (
            <button
              className="btn btn-sm btn-outline-light ms-3"
              onClick={() => setShowSelector(true)}
            >
              Select Development Requester
            </button>
          )}
        </div>
      </nav>

      {showSelector && !requester && (
        <div className="p-3">
          <RequesterSelectionWrapper
            onDone={() => setShowSelector(false)}
          />
        </div>
      )}

      {view === "checkSystem" ? <TicketDeskApp /> : view === "createTicket" ? <CreateTicket /> : <MyTickets />}
    </div>
  );
}

function RequesterSelectionWrapper({
  onDone,
}: {
  onDone: () => void;
}) {
  const { requester } = useRequester();

  useEffect(() => {
    if (requester) {
      onDone();
    }
  }, [requester, onDone]);

  if (requester) {
    return null;
  }

  return <RequesterSelection />;
}

export default function App() {
  return (
    <RequesterProvider>
      <AppShell />
    </RequesterProvider>
  );
}