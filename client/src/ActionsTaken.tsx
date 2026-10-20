// Lab 4 Actions Taken panel (docs/lab-04/ui-spec.md Sections 5 and 6).
import { useEffect, useRef, useState } from "react";
import {
  ActionTaken,
  ActionInput,
  ApiError,
  StaffUser,
  createAction,
  fetchActions,
  fetchStaffUsers,
  updateAction,
  updateActionStatus,
} from "./api.js";

interface Props {
  ticketId: number;
  /** Requester view: list only, no controls. */
  readOnly?: boolean;
  /** Ticket is Closed or Cancelled: actions cannot change (BR-10). */
  ticketLocked?: boolean;
  /** Called after any successful change so the parent can refresh ticket data. */
  onChanged?: () => void;
}

interface FormState {
  actionAt: string;
  description: string;
  result: string;
  performedById: string; // "" = me (default)
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

type Panel =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; action: ActionTaken }
  | { kind: "complete"; action: ActionTaken }
  | { kind: "cancel"; action: ActionTaken };

const STATUS_LABEL: Record<string, string> = { PLANNED: "Planned", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const STATUS_CLASS: Record<string, string> = {
  PLANNED: "bg-white text-success border border-success",
  COMPLETED: "bg-success",
  CANCELLED: "bg-secondary",
};

function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyForm(): FormState {
  return {
    actionAt: toLocalInput(new Date()),
    description: "",
    result: "",
    performedById: "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function formFromAction(a: ActionTaken): FormState {
  return {
    actionAt: toLocalInput(a.actionAt),
    description: a.description,
    result: a.result ?? "",
    performedById: String(a.performedBy.id),
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote ?? "",
    attachmentNotes: a.attachmentNotes ?? "",
  };
}

function toInput(form: FormState): ActionInput {
  const input: ActionInput = {
    actionAt: form.actionAt ? new Date(form.actionAt).toISOString() : undefined,
    description: form.description,
    result: form.result.trim() ? form.result : null,
    followUpRequired: form.followUpRequired,
    followUpNote: form.followUpRequired ? form.followUpNote : null,
    attachmentNotes: form.attachmentNotes.trim() ? form.attachmentNotes : null,
  };
  if (form.performedById) input.performedById = Number(form.performedById);
  return input;
}

/** Client checks mirror the backend rules; the backend stays the authority. */
function validateForm(form: FormState, completing: boolean): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!form.description.trim()) fields.description = "Action description is required.";
  if (form.followUpRequired && !form.followUpNote.trim())
    fields.followUpNote = "Follow-up note is required when follow-up is needed.";
  if (completing && !form.result.trim()) fields.result = "Result is required to complete an action.";
  return fields;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ActionsTaken({ ticketId, readOnly = false, ticketLocked = false, onChanged }: Props) {
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [completeResult, setCompleteResult] = useState("");
  const requestId = useRef<string>(newRequestId());
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const canEdit = !readOnly && !ticketLocked;

  async function load() {
    setLoadState("loading");
    try {
      setActions(await fetchActions(ticketId));
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void load();
    if (!readOnly) {
      fetchStaffUsers().then(setStaff).catch(() => setStaff([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, readOnly]);

  function resetMessages() {
    setFieldErrors({});
    setFormError(null);
    setStale(false);
    setNotice(null);
  }

  function openCreate() {
    resetMessages();
    setForm(emptyForm());
    requestId.current = newRequestId(); // one key per form open (BR-21)
    setPanel({ kind: "create" });
  }

  function openEdit(action: ActionTaken) {
    resetMessages();
    setForm(formFromAction(action));
    setPanel({ kind: "edit", action });
  }

  function openComplete(action: ActionTaken) {
    resetMessages();
    setCompleteResult(action.result ?? "");
    setPanel({ kind: "complete", action });
  }

  function closePanel() {
    resetMessages();
    setPanel({ kind: "none" });
    addButtonRef.current?.focus();
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 409 && err.code === "STALE_UPDATE") {
        setStale(true);
        setFormError("This action was changed by someone else. Reload to see the latest version.");
        return;
      }
      if (err.status === 409 && err.code === "TICKET_LOCKED") {
        setFormError("This ticket is closed or cancelled, so its actions are read only.");
        return;
      }
      if (err.status === 400 && err.fields) {
        setFieldErrors(err.fields);
        setFormError("Please correct the highlighted fields.");
        return;
      }
      if (err.status === 403) {
        setFormError("You do not have permission to change actions.");
        return;
      }
      setFormError(err.message);
      return;
    }
    // Network failure: keep the form filled so the user can retry.
    setFormError("Could not reach the server. Your entry is kept; please try again.");
  }

  async function afterSuccess(message: string) {
    setPanel({ kind: "none" });
    setFieldErrors({});
    setFormError(null);
    setNotice(message);
    await load();
    onChanged?.();
  }

  async function submitForm(complete: boolean) {
    if (saving) return; // prevents double submit
    const errors = validateForm(form, complete);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (panel.kind === "create") {
        const created = await createAction(ticketId, { ...toInput(form), clientRequestId: requestId.current });
        if (complete) {
          await updateActionStatus(ticketId, created.id, created.version, "COMPLETED", form.result);
        }
        await afterSuccess(complete ? "Action saved and completed." : "Action saved.");
      } else if (panel.kind === "edit") {
        await updateAction(ticketId, panel.action.id, panel.action.version, toInput(form));
        await afterSuccess("Action updated.");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatus(status: "COMPLETED" | "CANCELLED") {
    if (saving || (panel.kind !== "complete" && panel.kind !== "cancel")) return;
    if (status === "COMPLETED" && !completeResult.trim()) {
      setFieldErrors({ result: "Result is required to complete an action." });
      return;
    }
    setSaving(true);
    try {
      await updateActionStatus(ticketId, panel.action.id, panel.action.version, status, status === "COMPLETED" ? completeResult : undefined);
      await afterSuccess(status === "COMPLETED" ? "Action completed." : "Action cancelled.");
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function reloadAfterConflict() {
    resetMessages();
    setPanel({ kind: "none" });
    await load();
  }

  const fieldId = (name: string) => `action-${name}`;
  const errorProps = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": `${fieldId(name)}-error`, className: "form-control is-invalid" }
      : { className: "form-control" };
  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <div id={`${fieldId(name)}-error`} className="invalid-feedback d-block">
        {fieldErrors[name]}
      </div>
    ) : null;

  function renderFeedback() {
    return (
      <>
        {formError && (
          <div className="alert alert-danger py-2 d-flex flex-wrap gap-2 align-items-center" role="alert">
            <span>{formError}</span>
            {stale && (
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={reloadAfterConflict}>
                Reload
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  function renderForm() {
    const isCreate = panel.kind === "create";
    return (
      <form
        className="border rounded p-3 mb-3"
        style={{ background: "#F7FBF7" }}
        aria-label={isCreate ? "Add action" : "Edit action"}
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm(false);
        }}
        noValidate
      >
        <h4 className="h6 mb-3">{isCreate ? "Add Action" : "Edit Action"}</h4>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label htmlFor={fieldId("actionAt")} className="form-label">Action Date/Time</label>
            <input
              id={fieldId("actionAt")}
              type="datetime-local"
              value={form.actionAt}
              onChange={(e) => setForm({ ...form, actionAt: e.target.value })}
              {...errorProps("actionAt")}
            />
            <FieldError name="actionAt" />
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor={fieldId("performedById")} className="form-label">Performed by</label>
            <select
              id={fieldId("performedById")}
              value={form.performedById}
              onChange={(e) => setForm({ ...form, performedById: e.target.value })}
              {...errorProps("performedById")}
              className={fieldErrors.performedById ? "form-select is-invalid" : "form-select"}
            >
              {isCreate && <option value="">Me (default)</option>}
              {staff.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
              {!isCreate && panel.kind === "edit" && !staff.some((u) => u.id === panel.action.performedBy.id) && (
                <option value={panel.action.performedBy.id}>{panel.action.performedBy.name}</option>
              )}
            </select>
            <FieldError name="performedById" />
          </div>
          <div className="col-12">
            <label htmlFor={fieldId("description")} className="form-label">
              Action Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              id={fieldId("description")}
              rows={2}
              required
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              {...errorProps("description")}
            />
            <FieldError name="description" />
          </div>
          <div className="col-12">
            <label htmlFor={fieldId("result")} className="form-label">Result</label>
            <textarea
              id={fieldId("result")}
              rows={2}
              maxLength={2000}
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              {...errorProps("result")}
            />
            <div className="form-text">Required when the action is completed.</div>
            <FieldError name="result" />
          </div>
          <div className="col-12">
            <div className="form-check">
              <input
                id={fieldId("followUpRequired")}
                type="checkbox"
                className="form-check-input"
                checked={form.followUpRequired}
                onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })}
              />
              <label htmlFor={fieldId("followUpRequired")} className="form-check-label">Follow-up required</label>
            </div>
          </div>
          {form.followUpRequired && (
            <div className="col-12">
              <label htmlFor={fieldId("followUpNote")} className="form-label">
                Follow-up Note <span aria-hidden="true">*</span>
              </label>
              <textarea
                id={fieldId("followUpNote")}
                rows={2}
                required
                maxLength={1000}
                value={form.followUpNote}
                onChange={(e) => setForm({ ...form, followUpNote: e.target.value })}
                {...errorProps("followUpNote")}
              />
              <FieldError name="followUpNote" />
            </div>
          )}
          <div className="col-12">
            <label htmlFor={fieldId("attachmentNotes")} className="form-label">Attachment Notes</label>
            <input
              id={fieldId("attachmentNotes")}
              type="text"
              maxLength={500}
              placeholder="e.g. see screenshot error.png in Attachments"
              value={form.attachmentNotes}
              onChange={(e) => setForm({ ...form, attachmentNotes: e.target.value })}
              {...errorProps("attachmentNotes")}
            />
            <FieldError name="attachmentNotes" />
          </div>
        </div>
        <div className="mt-3">{renderFeedback()}</div>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <button type="submit" className="btn btn-success" disabled={saving}>
            {saving ? "Saving…" : isCreate ? "Save as Planned" : "Save Changes"}
          </button>
          {isCreate && (
            <button type="button" className="btn btn-outline-success" disabled={saving} onClick={() => void submitForm(true)}>
              Save and Complete
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={closePanel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderStatusPanel(action: ActionTaken, kind: "complete" | "cancel") {
    return (
      <div className="border rounded p-3 mb-3" style={{ background: "#F7FBF7" }} role="group" aria-label={kind === "complete" ? "Complete action" : "Cancel action"}>
        <h4 className="h6">{kind === "complete" ? "Complete action" : "Cancel action"}</h4>
        <p className="small text-muted" style={{ wordBreak: "break-word" }}>{action.description}</p>
        {kind === "complete" ? (
          <>
            <label htmlFor={fieldId(`complete-result-${action.id}`)} className="form-label">Result</label>
            <textarea
              id={fieldId(`complete-result-${action.id}`)}
              rows={2}
              maxLength={2000}
              className={fieldErrors.result ? "form-control is-invalid" : "form-control"}
              aria-invalid={fieldErrors.result ? true : undefined}
              aria-describedby={fieldErrors.result ? `${fieldId("result")}-error` : undefined}
              value={completeResult}
              onChange={(e) => setCompleteResult(e.target.value)}
              autoFocus
            />
            <FieldError name="result" />
            {fieldErrors.actionAt && <div className="text-danger small mt-1">{fieldErrors.actionAt}</div>}
          </>
        ) : (
          <p className="mb-2">Cancel this planned action? It stays in the list as Cancelled.</p>
        )}
        <div className="mt-2">{renderFeedback()}</div>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className={kind === "complete" ? "btn btn-success" : "btn btn-danger"}
            disabled={saving}
            onClick={() => void confirmStatus(kind === "complete" ? "COMPLETED" : "CANCELLED")}
          >
            {saving ? "Saving…" : kind === "complete" ? "Confirm Complete" : "Confirm Cancel"}
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={closePanel}>
            Back
          </button>
        </div>
      </div>
    );
  }

  function renderRowControls(action: ActionTaken) {
    if (!canEdit || action.status !== "PLANNED" || panel.kind !== "none") return null;
    return (
      <div className="d-flex flex-wrap gap-1">
        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => openEdit(action)} aria-label={`Edit action: ${action.description}`}>
          Edit
        </button>
        <button type="button" className="btn btn-sm btn-success" onClick={() => openComplete(action)} aria-label={`Complete action: ${action.description}`}>
          Complete
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setPanel({ kind: "cancel", action })} aria-label={`Cancel action: ${action.description}`}>
          Cancel
        </button>
      </div>
    );
  }

  function StatusBadge({ status }: { status: string }) {
    return <span className={`badge ${STATUS_CLASS[status] ?? "bg-secondary"}`}>{STATUS_LABEL[status] ?? status}</span>;
  }

  function Details({ action }: { action: ActionTaken }) {
    return (
      <>
        {action.followUpRequired && action.followUpNote && (
          <div className="small mt-1">
            <span className="badge bg-warning text-dark me-1">Follow-up</span>
            {action.followUpNote}
          </div>
        )}
        {action.attachmentNotes && (
          <div className="small text-muted mt-1">
            <span aria-hidden="true">📎 </span>
            <span className="visually-hidden">Attachment notes: </span>
            {action.attachmentNotes}
          </div>
        )}
      </>
    );
  }

  const title = readOnly ? "Work done on this ticket" : `Actions Taken (${actions.length})`;

  return (
    <section className="card p-3 mb-4" aria-labelledby={`actions-title-${ticketId}`}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 id={`actions-title-${ticketId}`} className="h5 mb-0">
          {title}
          {!readOnly && <span className="badge bg-light text-success border ms-2 fw-normal">Visible to requester</span>}
        </h3>
        {canEdit && panel.kind === "none" && (
          <button ref={addButtonRef} type="button" className="btn btn-success btn-sm" onClick={openCreate}>
            + Add Action
          </button>
        )}
      </div>

      {!readOnly && ticketLocked && (
        <p className="small text-muted">This ticket is closed or cancelled, so its actions are read only.</p>
      )}

      {notice && (
        <div className="alert alert-success py-2" role="status">
          {notice}
        </div>
      )}

      {(panel.kind === "create" || panel.kind === "edit") && renderForm()}
      {(panel.kind === "complete" || panel.kind === "cancel") && renderStatusPanel(panel.action, panel.kind)}

      {loadState === "loading" && <p className="text-muted mb-0">Loading actions…</p>}
      {loadState === "error" && (
        <div className="alert alert-danger py-2 d-flex flex-wrap gap-2 align-items-center" role="alert">
          <span>Actions could not be loaded.</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {loadState === "ready" && actions.length === 0 && (
        <p className="text-muted mb-0">
          {readOnly ? "IT Staff haven't recorded any actions yet." : "No actions recorded yet."}
        </p>
      )}

      {loadState === "ready" && actions.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="d-none d-lg-block">
            <table className="table align-middle mb-0">
              <caption className="visually-hidden">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Date/Time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Performed by</th>
                  <th scope="col">Status</th>
                  {canEdit && <th scope="col"><span className="visually-hidden">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} className={a.status === "CANCELLED" ? "text-muted" : undefined}>
                    <td className="text-nowrap small">{formatDate(a.actionAt)}</td>
                    <td style={{ wordBreak: "break-word" }}>
                      {a.description}
                      <Details action={a} />
                    </td>
                    <td style={{ wordBreak: "break-word" }}>{a.result ?? <span className="text-muted">—</span>}</td>
                    <td>{a.performedBy.name}</td>
                    <td><StatusBadge status={a.status} /></td>
                    {canEdit && <td>{renderRowControls(a)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablet and mobile cards */}
          <ul className="list-unstyled d-lg-none mb-0">
            {actions.map((a) => (
              <li key={a.id} className="border rounded p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <span className="small text-muted">{formatDate(a.actionAt)}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-2" style={{ wordBreak: "break-word" }}>{a.description}</div>
                <dl className="row small mb-0 mt-2">
                  <dt className="col-5">Result</dt>
                  <dd className="col-7" style={{ wordBreak: "break-word" }}>{a.result ?? "—"}</dd>
                  <dt className="col-5">Performed by</dt>
                  <dd className="col-7">{a.performedBy.name}</dd>
                </dl>
                <Details action={a} />
                <div className="mt-2">{renderRowControls(a)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
