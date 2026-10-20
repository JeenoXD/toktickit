# Lab 4 API Contract
All endpoints are prefixed `/api` and require the Lab 3 HTTP-only JWT cookie unless noted. Identity and role always come from the session. All Lab 2 and Lab 3 endpoints in `docs/lab-03/api-spec.md` remain, with the changes listed in Section 4.

## 1. Common Conventions
**Error body:** `{ "error": "CODE", "message": "Safe human-readable text", "fields"?: { "field": "message" }, "current"?: { ...latest record } }`

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad or missing fields; `fields` lists each problem |
| 400 | `INVALID_STATUS_TRANSITION` | Transition not in the matrix (spec BR-14) |
| 401 | `UNAUTHORIZED` | No or invalid session |
| 403 | `FORBIDDEN` | Role not permitted |
| 404 | `NOT_FOUND` | Missing, or a Requester asking for a Ticket they do not own (existence not revealed) |
| 409 | `STALE_UPDATE` | `version` does not match; `current` holds the latest record |
| 409 | `RESOLUTION_GATE_FAILED` | Resolve blocked; `reasons`: `NO_OWNER`, `NO_COMPLETED_ACTION`, `PLANNED_ACTIONS_OPEN` |
| 409 | `TICKET_LOCKED` | Action write on a Closed or Cancelled Ticket |
| 409 | `PLANNED_ACTIONS_OPEN` | Cancel Ticket while Planned actions exist |
| 500 | `INTERNAL_ERROR` | Unexpected failure; no stack trace or SQL in the body |

Dates are ISO 8601 UTC strings. `version` is an integer returned on every Ticket and Action Taken.

## 2. Actions Taken
**ActionTaken shape:**
```json
{
  "id": 12, "ticketId": 4, "actionAt": "2026-10-21T03:15:00.000Z",
  "description": "Replaced laptop battery", "result": "Battery holds charge for 6h",
  "status": "COMPLETED",
  "performedBy": { "id": 6, "name": "Michael IT" },
  "createdBy": { "id": 5, "name": "Somchai IT" },
  "followUpRequired": true, "followUpNote": "Check again next Monday",
  "attachmentNotes": "See attachment battery-report.pdf",
  "completedAt": "2026-10-21T03:20:00.000Z", "cancelledAt": null,
  "version": 3, "createdAt": "...", "updatedAt": "..."
}
```

### GET /api/tickets/:id/actions
List actions, ordered `actionAt` asc then `id` asc.
- **Roles:** IT Staff, Admin (any Ticket); Requester (own Ticket only, read only).
- **200:** `{ "data": [ActionTaken] }` (empty array for legacy Tickets).
- **Errors:** 401, 404 (missing, or not the Requester's Ticket).

### POST /api/tickets/:id/actions
- **Roles:** IT Staff, Admin. Requester → 403.
- **Body:** `{ "description": "string", "actionAt"?: "ISO", "result"?: "string", "performedById"?: 6, "followUpRequired"?: false, "followUpNote"?: "string", "attachmentNotes"?: "string", "clientRequestId"?: "uuid" }`
- Server sets `createdById` = session user, `status` = `PLANNED`, `performedById` = body value or session user, `actionAt` = body value or now. Any `createdById`, `status`, or `ticketId` in the body is ignored.
- **201:** ActionTaken. **200:** same action when `clientRequestId` was already used on this Ticket (BR-21).
- **Errors:** 400 (BR-03, BR-06 to BR-09 validation), 403, 404, 409 `TICKET_LOCKED`.

### PATCH /api/tickets/:id/actions/:actionId
Edit a Planned action.
- **Roles:** IT Staff, Admin.
- **Body:** `{ "version": 2, ...any of description, actionAt, result, performedById, followUpRequired, followUpNote, attachmentNotes }`
- **200:** updated ActionTaken with `version` + 1.
- **Errors:** 400 (validation, missing `version`, or action not Planned → `ACTION_NOT_EDITABLE`), 403, 404 (action not on this Ticket), 409 `STALE_UPDATE`, 409 `TICKET_LOCKED`.

### PATCH /api/tickets/:id/actions/:actionId/status
Complete or cancel a Planned action.
- **Roles:** IT Staff, Admin.
- **Body:** `{ "status": "COMPLETED" | "CANCELLED", "version": 2, "result"?: "string" }` (`result` required for COMPLETED unless already set).
- Sets `completedAt` or `cancelledAt` = now; bumps `version`; bumps Ticket `updatedAt`.
- **Errors:** 400 (`INVALID_ACTION_TRANSITION`, missing result), 403, 404, 409 `STALE_UPDATE`, 409 `TICKET_LOCKED`.

### GET /api/staff-users
Active IT Staff and Administrators for the performer and reassign pickers.
- **Roles:** IT Staff, Admin. **200:** `{ "data": [{ "id": 6, "name": "Michael IT", "role": "IT_STAFF" }] }`

## 3. Ticket Workflow
### PATCH /api/tickets/:id/status (changed)
- **Roles:** IT Staff, Admin; Cancelled → Reopened Admin only.
- **Body:** `{ "status": "RESOLVED", "version": 7 }`
- Runs in one transaction: version check, matrix check (BR-14), owner rule (BR-17), resolution gate (BR-15), planned-action cancel rule (BR-16), then updates status, sets `resolvedAt` when Resolved, clears `requesterResolvedAt` per BR-19, bumps `version`, appends one `TicketStatusHistory` row.
- **200:** updated Ticket including `version`, `allowedTransitions`.
- **Errors:** 400 `VALIDATION_ERROR` / `INVALID_STATUS_TRANSITION` / `OWNER_REQUIRED`, 403, 404, 409 `STALE_UPDATE` / `RESOLUTION_GATE_FAILED` / `PLANNED_ACTIONS_OPEN`.

### GET /api/tickets/:id/allowed-transitions
- **Roles:** IT Staff, Admin. **200:** `{ "currentStatus": "IN_PROGRESS", "version": 7, "allowed": [{ "status": "RESOLVED", "blockedBy": ["NO_COMPLETED_ACTION"] }, { "status": "WAITING_FOR_REQUESTER", "blockedBy": [] }] }`. The UI uses `blockedBy` to explain disabled options; the PATCH still re-checks everything.

### GET /api/tickets/:id/status-history
- **Roles:** IT Staff, Admin (any), Requester (own only, else 404).
- **200:** `{ "data": [{ "id": 1, "fromStatus": null, "toStatus": "NEW", "changedBy": { "id": 3, "name": "Jennifer" }, "changedAt": "..." }] }` ordered `changedAt` asc, `id` asc. No write endpoint exists (append-only).

### PATCH /api/tickets/:id/claim, /reassign, /priority (changed)
Same as Lab 3, plus required `"version"` in the body. `reassign` now also rejects inactive target users (400). Mismatch → 409 `STALE_UPDATE`. Each bumps `version`.

### PATCH /api/tickets/:id/requester-resolved (changed)
- **Roles:** Requester who owns the Ticket.
- Sets `requesterResolvedAt` = now if null (repeat calls are idempotent and return 200). Status is **not** changed.
- **Errors:** 403 (not a Requester), 404 (not owner), 400 `INVALID_STATUS_TRANSITION` if Resolved, Closed, or Cancelled.

## 4. Changes to Existing Endpoints
- `GET /api/tickets/:id` now includes `version`, `requesterResolvedAt`, `resolvedAt`, `actionsTakenCount`. Requesters still never receive Internal Notes.
- `GET /api/tickets` (Requester list) gains `status` (comma-separated list) and `statusGroup=active`.
- `GET /api/tickets/queue` gains `status` (comma-separated), `statusGroup=active`, `owner=me|unassigned`, `appearsResolved=true`. Existing params unchanged.

## 5. Dashboards
Counts are computed with Prisma `count`/`groupBy` on the server, never by fetching full Ticket lists. Recent window = from 00:00 Asia/Bangkok six days ago to now. Lists return at most 5 items in the shape `{ id, ticketNumber, summary, currentStatus, itPriority, updatedAt }`.

### GET /api/dashboard/requester
- **Roles:** Requester only (IT Staff/Admin → 403). Scoped to session user; query params are ignored.
- **200:**
```json
{
  "metrics": {
    "openTickets":  { "count": 3, "drillDown": { "view": "myTickets", "filters": { "statusGroup": "active" } } },
    "waitingForMe": { "count": 1, "drillDown": { "view": "myTickets", "filters": { "status": "WAITING_FOR_REQUESTER" } } },
    "resolved":     { "count": 5, "drillDown": { "view": "myTickets", "filters": { "status": "RESOLVED" } } },
    "closed":       { "count": 12, "drillDown": { "view": "myTickets", "filters": { "status": "CLOSED" } } }
  },
  "recentlyUpdated": [],
  "recentlyResolved": [],
  "generatedAt": "2026-10-21T05:00:00.000Z"
}
```

### GET /api/dashboard/staff
- **Roles:** IT Staff, Admin (Requester → 403).
- **200:**
```json
{
  "metrics": {
    "unassigned":       { "count": 4, "drillDown": { "view": "ticketQueue", "filters": { "statusGroup": "active", "owner": "unassigned" } } },
    "myAssigned":       { "count": 6, "drillDown": { "view": "ticketQueue", "filters": { "statusGroup": "active", "owner": "me" } } },
    "waitingForRequester": { "count": 2, "drillDown": { "view": "ticketQueue", "filters": { "status": "WAITING_FOR_REQUESTER" } } },
    "appearsResolved":  { "count": 1, "drillDown": { "view": "ticketQueue", "filters": { "statusGroup": "active", "appearsResolved": "true" } } },
    "myPlannedActions": { "count": 3, "items": [{ "actionId": 9, "ticketId": 4, "ticketNumber": "TKT-...", "description": "...", "actionAt": "..." }] },
    "myFollowUps":      { "count": 1, "items": [] }
  },
  "byStatus":     { "NEW": 2, "OPEN": 3, "IN_PROGRESS": 4, "WAITING_FOR_REQUESTER": 2, "RESOLVED": 3, "CLOSED": 5, "REOPENED": 1, "CANCELLED": 1 },
  "byItPriority": { "HIGH": 3, "MEDIUM": 5, "LOW": 2, "UNSET": 2 },
  "urgent": [],
  "recentlyUpdated": [],
  "users": { "active": { "REQUESTER": 4, "IT_STAFF": 3, "ADMINISTRATOR": 1 }, "inactive": 1 },
  "generatedAt": "..."
}
```
`users` is present only for Administrators. `byStatus` and `byItPriority` always contain every key, with 0 when empty.

## 6. Health
`GET /api/health` (no auth) → `{ "status": "ok", "database": "ok" }`; if the DB query fails → 503 `{ "status": "degraded", "database": "unavailable" }`.
