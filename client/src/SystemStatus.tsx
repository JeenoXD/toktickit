// Lab 1 health check, kept as a compact card on the Administrator dashboard (Lab 4).
import { useState } from "react";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function SystemStatus() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="card p-3 h-100" aria-labelledby="system-status-title">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h2 id="system-status-title" className="h6 mb-0">System status</h2>
        <button className="btn btn-sm btn-success" onClick={handleCheck} disabled={state === "loading"}>
          {state === "loading" ? "Checking…" : "Check System"}
        </button>
      </div>
      {state === "idle" && <p className="small text-muted mb-0">Check the API and database connection.</p>}
      {state === "success" && (
        <>
          <p className="mb-1 small">
            System Status: <strong className="text-success">Online</strong>
          </p>
          <ul className="list-inline small mb-0">
            {categories.map((c) => (
              <li key={c.id} className="list-inline-item badge bg-light text-dark border">{c.name}</li>
            ))}
          </ul>
        </>
      )}
      {state === "error" && (
        <p className="small text-danger mb-0" role="alert">System Status: Offline. Unable to connect to TokTickIT API.</p>
      )}
    </section>
  );
}
