import { useEffect, useState } from "react";
import { useRequester, Requester } from "./RequesterContext";

export default function RequesterSelection() {
  const { setRequester } = useRequester();
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error" | "empty">("loading");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/requesters`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data: Requester[]) => {
        setRequesters(data);
        setState(data.length === 0 ? "empty" : "success");
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setState("error"));
  }, []);

  function handleContinue() {
    const found = requesters.find((r) => r.id === selectedId);
    if (found) setRequester(found);
  }

  if (state === "loading") return <p>Loading requesters…</p>;
  if (state === "error") return <p className="text-danger">Unable to load requesters. Please try again later.</p>;
  if (state === "empty") return <p>No active requesters are available for testing right now.</p>;

  return (
    <div className="card p-4 mx-auto" style={{ maxWidth: 480 }}>
      <h2>Select Development Requester</h2>
      <p className="text-muted">
        Choose a development requester to simulate the current requester context for Lab 2.
      </p>
      <label className="form-label">Development Requester *</label>
      <select
        className="form-select mb-3"
        value={selectedId ?? ""}
        onChange={(e) => setSelectedId(Number(e.target.value))}
      >
        {requesters.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <div className="alert alert-success py-2">Only active development requesters are shown.</div>
      <button className="btn btn-success" onClick={handleContinue}>Continue →</button>
    </div>
  );
}