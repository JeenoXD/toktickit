import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
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

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <>
          <p className="mt-3">System Status: <strong>Online</strong></p>
          <ul className="list-group">
            {categories.map((c) => (
              <li key={c.id} className="list-group-item">{c.name}</li>
            ))}
          </ul>
        </>
      )}
      {state === "error" && <p className="mt-3 text-danger">System Status: Offline — {errorMsg}</p>}
      {/* TODO(Issue 4): render loading / success (Online + categories) / error (Offline) states. */}
    </div>
  );
}
