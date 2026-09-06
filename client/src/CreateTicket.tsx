import { useEffect, useState } from "react";
import {
  fetchCategories, fetchRelatedSystems, createTicket,
  Category, RelatedSystem, Priority, CreateTicketResult,
} from "./api.js";
import { useRequester } from "./RequesterContext";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

type RefState = "loading" | "ready" | "error";
type SubmitState = "idle" | "submitting" | "success" | "error";

type PickedFile = { file: File; error?: string };

export default function CreateTicket() {
  const { requester } = useRequester();

  const [refState, setRefState] = useState<RefState>("loading");
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [relatedSystemId, setRelatedSystemId] = useState<number | "">("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority>("MEDIUM");
  const [files, setFiles] = useState<PickedFile[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTicketResult | null>(null);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([cats, systems]) => {
        setCategories(cats);
        setRelatedSystems(systems);
        setRefState("ready");
      })
      .catch(() => setRefState("error"));
  }, []);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedSummary = summary.trim();
    const trimmedDescription = description.trim();

    if (trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      errors.summary = "Summary must be between 5 and 150 characters.";
    }
    if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
      errors.description = "Description must be between 10 and 2000 characters.";
    }
    if (!categoryId) {
      errors.categoryId = "Category is required.";
    }
    if (!relatedSystemId) {
      errors.relatedSystemId = "Related System is required.";
    }
    return errors;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const combined = [...files];

    for (const file of selected) {
      let error: string | undefined;
      if (!ALLOWED_TYPES.includes(file.type)) {
        error = "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.";
      } else if (file.size > MAX_SIZE_BYTES) {
        error = "File exceeds the 5 MB size limit.";
      } else if (combined.length >= MAX_ATTACHMENTS) {
        error = "Maximum of 5 attachments per ticket.";
      }
      combined.push({ file, error });
    }

    setFiles(combined);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitState === "submitting") return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!requester) {
      setSubmitState("error");
      setSubmitError("No Development Requester selected.");
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const ticket = await createTicket({
        requesterId: requester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      });
      setResult(ticket);
      setSubmitState("success");
    } catch (err) {
      const e2 = err as Error & { fields?: Record<string, string> };
      if (e2.fields) {
        setFieldErrors(e2.fields);
        setSubmitState("idle");
      } else {
        setSubmitState("error");
        setSubmitError(e2.message || "Unable to connect to TokTickIT API");
      }
    }
  }

  if (refState === "loading") return <p>Loading reference data…</p>;
  if (refState === "error") return <p className="text-danger">Unable to load categories or related systems.</p>;

  if (submitState === "success" && result) {
    return (
      <div className="alert alert-success">
        <h4>Ticket Created</h4>
        <p>Your official Ticket Number is <strong>{result.ticketNumber}</strong>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-3" style={{ maxWidth: 640 }}>
      <h2>Create Ticket</h2>

      <div className="mb-3">
        <label htmlFor="requester" className="form-label">Requester</label>
        <input id="requester" className="form-control" value={requester?.name ?? ""} disabled readOnly />
      </div>

      <div className="mb-3">
        <label htmlFor="categoryId" className="form-label">Category *</label>
        <select
          id="categoryId"
          className="form-select"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select a category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {fieldErrors.categoryId && <div className="text-danger small">{fieldErrors.categoryId}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="relatedSystemId" className="form-label">Related System *</label>
        <select
          id="relatedSystemId"
          className="form-select"
          value={relatedSystemId}
          onChange={(e) => setRelatedSystemId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select a related system</option>
          {relatedSystems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {fieldErrors.relatedSystemId && <div className="text-danger small">{fieldErrors.relatedSystemId}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="requestedPriority" className="form-label">Requested Priority *</label>
        <select
          id="requestedPriority"
          className="form-select"
          value={requestedPriority}
          onChange={(e) => setRequestedPriority(e.target.value as Priority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <div className="mb-3">
        <label htmlFor="summary" className="form-label">Summary *</label>
        <input
          id="summary"
          className="form-control"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={150}
        />
        {fieldErrors.summary && <div className="text-danger small">{fieldErrors.summary}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="description" className="form-label">Description *</label>
        <textarea
          id="description"
          className="form-control"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        {fieldErrors.description && <div className="text-danger small">{fieldErrors.description}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="attachments" className="form-label">Attachments</label>
        <input
          id="attachments"
          type="file"
          className="form-control"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleFileSelect}
        />
        <ul className="list-group mt-2">
          {files.map((f, i) => (
            <li key={i} className={`list-group-item d-flex justify-content-between ${f.error ? "text-danger" : ""}`}>
              <span>{f.file.name} ({Math.round(f.file.size / 1024)} KB){f.error ? ` — ${f.error}` : ""}</span>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => removeFile(i)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>

      {submitState === "error" && (
        <div className="alert alert-danger">{submitError}</div>
      )}

      <button type="submit" className="btn btn-success" disabled={submitState === "submitting"}>
        {submitState === "submitting" ? "Submitting…" : "Submit Ticket"}
      </button>
    </form>
  );
}