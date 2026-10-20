// Lab 4 Actions Taken rules (docs/lab-04/specification.md BR-05 to BR-10).
// Pure functions so they can be unit tested without the database.

export const ACTION_DESCRIPTION_MAX = 2000;
export const ACTION_RESULT_MAX = 2000;
export const FOLLOW_UP_NOTE_MAX = 1000;
export const ATTACHMENT_NOTES_MAX = 500;
export const CLIENT_REQUEST_ID_MAX = 100;
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const LOCKED_TICKET_STATUSES = ["CLOSED", "CANCELLED"] as const;

export type ActionStatusValue = "PLANNED" | "COMPLETED" | "CANCELLED";

export interface ActionInput {
  description?: unknown;
  actionAt?: unknown;
  result?: unknown;
  performedById?: unknown;
  followUpRequired?: unknown;
  followUpNote?: unknown;
  attachmentNotes?: unknown;
}

export interface ExistingAction {
  description: string;
  actionAt: Date;
  result: string | null;
  performedById: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export interface NormalizedAction {
  description: string;
  actionAt: Date;
  result: string | null;
  performedById: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export type FieldErrors = Record<string, string>;

export interface ValidationContext {
  ticketCreatedAt: Date;
  // Status the action will have after this save.
  targetStatus: ActionStatusValue;
  now?: Date;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Merges the request body over the existing action (for edits) or defaults
 * (for create), then validates the full result. Returns field errors or the
 * normalized values ready to save.
 */
export function validateAction(
  input: ActionInput,
  base: ExistingAction,
  ctx: ValidationContext,
): { ok: true; value: NormalizedAction } | { ok: false; fields: FieldErrors } {
  const fields: FieldErrors = {};
  const now = ctx.now ?? new Date();

  // Description (BR-06)
  let description = base.description;
  if (input.description !== undefined) {
    description = typeof input.description === "string" ? input.description.trim() : "";
  }
  if (!description) fields.description = "Action description is required.";
  else if (description.length > ACTION_DESCRIPTION_MAX)
    fields.description = `Action description must be ${ACTION_DESCRIPTION_MAX} characters or fewer.`;

  // Result (BR-06)
  let result = base.result;
  if (input.result !== undefined) {
    if (input.result !== null && typeof input.result !== "string") fields.result = "Result must be text.";
    else result = optionalText(input.result) ?? null;
  }
  if (result && result.length > ACTION_RESULT_MAX)
    fields.result = `Result must be ${ACTION_RESULT_MAX} characters or fewer.`;
  if (ctx.targetStatus === "COMPLETED" && !result && !fields.result)
    fields.result = "Result is required to complete an action.";

  // Performed by: shape only here; active staff check needs the database (BR-03)
  let performedById = base.performedById;
  if (input.performedById !== undefined && input.performedById !== null) {
    const parsed = Number(input.performedById);
    if (!Number.isInteger(parsed) || parsed <= 0) fields.performedById = "Performed by must be a valid user.";
    else performedById = parsed;
  }

  // Follow-up (BR-07)
  let followUpRequired = base.followUpRequired;
  if (input.followUpRequired !== undefined) {
    if (typeof input.followUpRequired !== "boolean") fields.followUpRequired = "Follow-up required must be true or false.";
    else followUpRequired = input.followUpRequired;
  }
  let followUpNote = base.followUpNote;
  if (input.followUpNote !== undefined) {
    if (input.followUpNote !== null && typeof input.followUpNote !== "string")
      fields.followUpNote = "Follow-up note must be text.";
    else followUpNote = optionalText(input.followUpNote) ?? null;
  }
  if (!followUpRequired) {
    followUpNote = null;
  } else if (!fields.followUpNote) {
    if (!followUpNote) fields.followUpNote = "Follow-up note is required when follow-up is needed.";
    else if (followUpNote.length > FOLLOW_UP_NOTE_MAX)
      fields.followUpNote = `Follow-up note must be ${FOLLOW_UP_NOTE_MAX} characters or fewer.`;
  }

  // Attachment notes (BR-08)
  let attachmentNotes = base.attachmentNotes;
  if (input.attachmentNotes !== undefined) {
    if (input.attachmentNotes !== null && typeof input.attachmentNotes !== "string")
      fields.attachmentNotes = "Attachment notes must be text.";
    else attachmentNotes = optionalText(input.attachmentNotes) ?? null;
  }
  if (attachmentNotes && attachmentNotes.length > ATTACHMENT_NOTES_MAX)
    fields.attachmentNotes = `Attachment notes must be ${ATTACHMENT_NOTES_MAX} characters or fewer.`;

  // Action date/time (BR-09)
  let actionAt = base.actionAt;
  if (input.actionAt !== undefined && input.actionAt !== null && input.actionAt !== "") {
    const parsed = typeof input.actionAt === "string" ? new Date(input.actionAt) : new Date(NaN);
    if (Number.isNaN(parsed.getTime())) fields.actionAt = "Action date/time is not a valid date.";
    else actionAt = parsed;
  }
  if (!fields.actionAt) {
    // The UI picks times to the minute, so compare against the minute the ticket was created in.
    const createdMinute = Math.floor(ctx.ticketCreatedAt.getTime() / 60000) * 60000;
    if (actionAt.getTime() < createdMinute)
      fields.actionAt = "Action date/time cannot be before the ticket was created.";
    else if (ctx.targetStatus === "COMPLETED" && actionAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS)
      fields.actionAt = "A completed action cannot be dated in the future.";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: { description, actionAt, result, performedById, followUpRequired, followUpNote, attachmentNotes },
  };
}

/** BR-05: only Planned actions change status, and only to Completed or Cancelled. */
export function canTransitionAction(from: ActionStatusValue, to: unknown): boolean {
  return from === "PLANNED" && (to === "COMPLETED" || to === "CANCELLED");
}

/** BR-10 */
export function isTicketLocked(status: string): boolean {
  return (LOCKED_TICKET_STATUSES as readonly string[]).includes(status);
}

export function parseClientRequestId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CLIENT_REQUEST_ID_MAX) return { ok: false };
  return { ok: true, value: trimmed };
}

export function parseVersion(value: unknown): number | null {
  const n = Number(value);
  return value !== undefined && value !== null && value !== "" && Number.isInteger(n) && n > 0 ? n : null;
}
