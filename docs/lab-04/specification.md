# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal
Complete the TokTickIT service desk workflow. IT Staff and Administrators can plan and record Actions Taken under each Ticket, the final status matrix and resolution gate are enforced by the backend, Requesters and IT Staff get concise role dashboards linked to the detailed screens, and every Lab 1 to 3 feature keeps working in one polished, responsive Zen Green application.

## 2. Stakeholder Request Interpretation
Tickets and conversations already exist, but nobody can see what work was actually done. Each Ticket now carries a list of Actions Taken (date/time, description, result, who performed it, whether follow-up is needed and why, and notes about related files). The Ticket Owner still coordinates the Ticket, but any active IT Staff member may perform an action. A Requester saying "it looks fixed" is only a hint: IT Staff must review the recorded work and formally resolve the Ticket. Dashboards give each role a quick starting point and always link back to the full lists. Finally, the whole product is hardened and polished for the final demonstration.

## 3. Scope
**Included:**
- Actions Taken model, migration, seed, API, and Ticket Detail UI (list, create, view, edit, assign performer, complete, cancel).
- Final Ticket status-transition matrix with role rules, resolution gate, and append-only status history.
- Optimistic concurrency (stale-update detection) for Ticket workflow changes and Actions Taken edits.
- Duplicate-submit protection for action creation (idempotency key).
- Requester, IT Staff, and Administrator dashboards with backend-calculated metrics and drill-down.
- Requester "Problem Appears Resolved" changed to an advisory flag (no status change).
- Final regression, accessibility, responsive, and visual-consistency hardening of Labs 1 to 3.

**Explicitly Excluded:**
- SLA clocks, escalation, on-call schedules, breach alerts.
- Email, SMS, LINE, push, or any external notification.
- Inventory, spare parts, purchasing, cost or labor-time accounting, billing, payroll.
- Multi-level approvals, electronic signatures.
- BI tools, custom report builders, CSV/Excel export, charts beyond simple count cards.
- "Change from yesterday" deltas shown in the handout mockup (see Section 11).
- Multi-tenant organizations and production cloud operations.
- Uploading files directly to an Action Taken (Attachment Notes reference existing Ticket Attachments by text).

## 4. Functional Requirements (FR)
- **FR-01**: IT Staff and Administrators shall create an Action Taken on any Ticket that is not Closed or Cancelled.
- **FR-02**: IT Staff and Administrators shall edit a Planned Action Taken and change its performer, Action Date/Time, description, result, follow-up fields, and attachment notes.
- **FR-03**: IT Staff and Administrators shall complete or cancel a Planned Action Taken.
- **FR-04**: Requesters shall view, read only, all Actions Taken on Tickets they own; they shall not create or change them.
- **FR-05**: The system shall enforce the Ticket status-transition matrix (Section 5.2) and the resolution gate on the backend, and record every status change in an append-only history.
- **FR-06**: The system shall detect stale updates to a Ticket's workflow fields or to an Action Taken and reject them with a conflict response instead of overwriting.
- **FR-07**: Requesters shall flag that a problem appears resolved; the flag is shown to IT Staff and does not change Ticket status.
- **FR-08**: The system shall provide a Requester dashboard summarizing only the authenticated Requester's Tickets.
- **FR-09**: The system shall provide an IT Staff dashboard with queue, ownership, status, priority, and personal action metrics; Administrators see the same plus user-account counts.
- **FR-10**: Every dashboard count and list item shall drill down to the matching filtered list or Ticket Detail.
- **FR-11**: The dashboard shall be the landing screen after sign-in for every role.
- **FR-12**: All Lab 1 to 3 features (auth, password change, Create Ticket, My Tickets, Ticket Detail, Attachments, Public Comments, Internal Notes, Queue, claim/reassign, IT Priority, User Management) shall keep working.
- **FR-13**: Forms shall prevent duplicate submission, keep entered data after recoverable failures, and show consistent loading, empty, validation, forbidden, conflict, not-found, and safe-failure feedback.

## 5. Business Rules (BR)

### 5.1 Actions Taken
- **BR-01**: An Action Taken belongs to exactly one Ticket and never moves to another Ticket.
- **BR-02**: The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by a different IT Staff member or Administrator.
- **BR-03**: "Performed by" defaults automatically to the authenticated user on create. It may be changed only to an **active** IT Staff or Administrator; inactive users and Requesters are rejected.
- **BR-04**: "Recorded by" (`createdById`) is always the authenticated creator and can never be changed by the client.
- **BR-05**: Action status is `PLANNED`, `COMPLETED`, or `CANCELLED`. Allowed changes: `PLANNED → COMPLETED`, `PLANNED → CANCELLED`. Completed and Cancelled actions are final and read only.
- **BR-06**: Action Description is required (1 to 2000 characters, trimmed). Result is optional while Planned and required (1 to 2000 characters) to complete an action.
- **BR-07**: When Follow-Up Required is true, Follow-Up Note is required (1 to 1000 characters). When false, any Follow-Up Note is cleared.
- **BR-08**: Attachment Notes are optional free text (max 500 characters) describing which Ticket Attachment or external file to look at.
- **BR-09**: Action Date/Time defaults to now. It may not be earlier than the minute the Ticket was created in (UI time inputs have minute precision). A Completed action may not be dated more than 5 minutes in the future; a Planned action may be dated in the future.
- **BR-10**: Actions Taken cannot be created or edited while the Ticket is `CLOSED` or `CANCELLED`.
- **BR-11**: Actions Taken are never hard-deleted; cancelling is the only way to withdraw one.
- **BR-12**: Actions are listed in stable order: `actionAt` ascending, then `id` ascending.

### 5.2 Ticket Status and Resolution
- **BR-13**: Ticket statuses remain New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled.
- **BR-14**: Only IT Staff and Administrators may change Ticket status. Permitted transitions:

| From \ To | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| New | Staff | | | | | | Staff |
| Open | | Staff | Staff | | | | Staff |
| In Progress | Staff | | Staff | Staff (gate) | | | |
| Waiting for Requester | | Staff | | Staff (gate) | | | |
| Resolved | | | | | Staff | Staff | |
| Closed | | | | | | Staff | |
| Reopened | Staff | Staff | | | | | |
| Cancelled | | | | | | Admin only | |

"Staff" means IT Staff or Administrator. Any transition not listed is rejected with `400 INVALID_STATUS_TRANSITION`.
- **BR-15 (Resolution gate)**: A Ticket may move to Resolved only if it has an Owner, at least one `COMPLETED` Action Taken, and no `PLANNED` Actions Taken. Otherwise `409 RESOLUTION_GATE_FAILED` lists the unmet conditions.
- **BR-16**: A Ticket with `PLANNED` actions cannot be Cancelled; the actions must be completed or cancelled first.
- **BR-17**: Moving to In Progress requires an Owner.
- **BR-18**: Every successful status change appends one `TicketStatusHistory` row (from, to, changed by, time). History rows are never updated or deleted.
- **BR-19**: The Requester "Problem Appears Resolved" flag sets `requesterResolvedAt` and does not change status. It is allowed only when the Ticket is not Resolved, Closed, or Cancelled. It is cleared when the Ticket is Resolved, Reopened, or moved back to Open. (Replaces Lab 3 BR-05, which moved the Ticket to In Progress.)
- **BR-20**: Ticket workflow changes (status, IT Priority, claim, reassign) and Action Taken updates must send the record's current `version`. A mismatch returns `409 STALE_UPDATE` with the latest record; nothing is overwritten.
- **BR-21**: Action creation accepts an optional `clientRequestId`. A repeat request with the same key for the same Ticket returns the original action (200) instead of creating a duplicate.

### 5.3 Dashboard Calculations
All counts are calculated by the backend from the database at request time. "Active" statuses = New, Open, In Progress, Waiting for Requester, Reopened. "Recent" means the last 7 days, using Asia/Bangkok (UTC+7) day boundaries: from 00:00 Bangkok time six days ago up to now.
- **BR-22 (Requester)**: All Requester metrics include only Tickets where `requesterId` = authenticated user.
  - `openTickets`: status in Active.
  - `waitingForMe`: status = Waiting for Requester.
  - `resolved`: status = Resolved.
  - `closed`: status = Closed.
  - `recentlyUpdated`: up to 5 own Tickets, `updatedAt` desc.
  - `recentlyResolved`: up to 5 own Tickets that are currently Resolved or Closed and whose latest move to Resolved is within Recent, newest first.
- **BR-23 (IT Staff)**:
  - `unassigned`: Active and `ownerId` is null.
  - `myAssigned`: Active and `ownerId` = current user.
  - `byStatus`: count for each of the 8 statuses across all Tickets.
  - `byItPriority`: Active Tickets counted by High, Medium, Low, and Unset.
  - `appearsResolved`: Active and `requesterResolvedAt` not null.
  - `myPlannedActions`: Actions with status Planned and `performedById` = current user.
  - `myFollowUps`: Actions with Follow-Up Required = true, status Completed, `performedById` = current user, on Active Tickets.
  - `urgent`: up to 5 Active Tickets with IT Priority High, unassigned first, then oldest `createdAt` first.
  - `recentlyUpdated`: up to 5 Active Tickets, `updatedAt` desc.
- **BR-24 (Administrator)**: Administrator dashboard = IT Staff dashboard plus `users`: active count per role and total inactive count.
- **BR-25**: A metric with no matching records returns 0 (lists return `[]`); the UI shows an empty state, never an error.

## 6. UI Specification Summary
See `docs/lab-04/ui-spec.md`.
- New **Dashboard** nav item, first in the nav, default landing screen for all roles, active-page indication on all nav items.
- **IT Staff / Admin Dashboard**: metric cards (Unassigned, My Assigned, Waiting for Requester, Appears Resolved, My Planned Actions), status and priority breakdown, Urgent and Recently Updated lists, Quick Actions.
- **Requester Dashboard**: cards (My Open, Waiting for Me, Resolved, Closed), Recently Updated and Recently Resolved lists, Quick Actions.
- **Actions Taken panel** on IT Staff Ticket Detail (create form, list, view/edit mode, complete/cancel) and read-only on Requester Ticket Detail.
- **Status control** shows only permitted next statuses; gate failures and stale conflicts show inline with a Reload option.
- Status history timeline on both Ticket Detail screens.

## 7. Data Changes (Prisma Schema Evolution)
- **New enum `ActionStatus`**: `PLANNED`, `COMPLETED`, `CANCELLED`.
- **New model `ActionTaken`**: `id`, `ticketId` (FK → Ticket, cascade), `actionAt` DateTime, `description` String, `result` String?, `status` ActionStatus default `PLANNED`, `performedById` (FK → User), `createdById` (FK → User), `followUpRequired` Boolean default false, `followUpNote` String?, `attachmentNotes` String?, `clientRequestId` String?, `version` Int default 1, `completedAt` DateTime?, `cancelledAt` DateTime?, `createdAt`, `updatedAt`. Indexes: `(ticketId, actionAt, id)`, `(performedById, status)`. Unique: `(ticketId, clientRequestId)`.
- **New model `TicketStatusHistory`**: `id`, `ticketId` (FK, cascade), `fromStatus` TicketStatus?, `toStatus` TicketStatus, `changedById` (FK → User), `changedAt` default now. Index `(ticketId, changedAt, id)`.
- **Ticket additions**: `version` Int default 1, `requesterResolvedAt` DateTime?, `resolvedAt` DateTime?. New index `(ownerId, currentStatus)` and `(itPriority, currentStatus)` for dashboard counts.
- **Migration** (`20261020120000_lab4_actions_taken`): additive only. Creates the enum, both tables, and new nullable or defaulted columns; no existing column is dropped or renamed, so all Users, Tickets, Attachments, Public Comments, and Internal Notes stay valid.
- **Backfill** (in the same migration SQL):
  1. Every existing Ticket gets one history row `(fromStatus NULL → currentStatus, changedBy = requesterId, changedAt = createdAt)` so history is never empty.
  2. Tickets already Resolved or Closed get `resolvedAt = updatedAt`.
  3. No Actions Taken are invented for legacy Tickets. Legacy Tickets already Resolved or Closed stay as they are (the gate applies only to new transitions); legacy Active Tickets need a completed action before they can be Resolved.
  4. Lab 3 Tickets that were moved to In Progress by the old "appears resolved" action cannot be identified reliably, so `requesterResolvedAt` stays null for them.
- **Rollback / recovery**: before migrating, `pg_dump` the database. The migration is additive, so a rollback script (`server/prisma/rollback/lab4_rollback.sql`) drops the two new tables, the enum, and the new Ticket columns, returning to the Lab 3 schema without touching Lab 3 data. Tested by: migrate a Lab 3 seeded DB, verify row counts unchanged (MIG tests), run rollback, verify Lab 3 tests still pass.
- **Seed**: idempotent; it keeps the Lab 3 reset-and-reseed approach (truncate in dependency order, then recreate), so running it any number of times gives the same data. Each seeded Ticket also gets a realistic status-history path, and tickets are spaced 12 hours apart so seeded resolutions fall inside the 7-day dashboard window. Adds Tickets covering all 8 statuses, all IT Priorities including unset, assigned and unassigned owners; Tickets with 0, 1, and 3 Actions Taken (mix of Planned/Completed/Cancelled, one with follow-up and attachment notes, one performed by a non-owner); one Requester with no Tickets (zero dashboard); one Ticket flagged appears resolved.

**Justified design decisions:**
1. **Integer `version` column instead of comparing `updatedAt`**: timestamps can collide at millisecond resolution and differ in precision between JavaScript and PostgreSQL; an integer incremented in the same `UPDATE ... WHERE id = ? AND version = ?` makes stale detection atomic and easy to test.
2. **Status as `PLANNED/COMPLETED/CANCELLED` with soft cancel instead of delete**: the stakeholder wants to plan and track work; keeping cancelled rows preserves an honest audit trail and lets the resolution gate reason about outstanding work.
3. **Separate append-only `TicketStatusHistory` table**: gives "recently resolved" a reliable timestamp and an audit trail without overloading `updatedAt`, which changes for any edit.
4. **Composite indexes on `(ownerId, currentStatus)` and `(itPriority, currentStatus)`**: dashboard counts filter on exactly these pairs.

## 8. API Contract Summary
See `docs/lab-04/api-spec.md`. New or changed:
- `GET /api/tickets/:id/actions`, `POST /api/tickets/:id/actions`, `PATCH /api/tickets/:id/actions/:actionId`, `PATCH /api/tickets/:id/actions/:actionId/status`
- `GET /api/tickets/:id/status-history`, `GET /api/tickets/:id/allowed-transitions`
- `PATCH /api/tickets/:id/status` (now requires `version`, enforces BR-14 to BR-18)
- `PATCH /api/tickets/:id/claim | reassign | priority` (now require `version`)
- `PATCH /api/tickets/:id/requester-resolved` (advisory flag only)
- `GET /api/dashboard/requester`, `GET /api/dashboard/staff`
- `GET /api/tickets` and `GET /api/tickets/queue` gain drill-down filters (`status` list, `statusGroup=active`, `owner=me|unassigned`, `appearsResolved=true`)
- `GET /api/staff-users` (active IT Staff/Admin list for the performer picker)

## 9. Acceptance Criteria
- **AC-01**: Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated user as creator and the approved performer (default self).
- **AC-02**: Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned.
- **AC-03**: Given IT Staff on Ticket Detail, when they create, edit, and complete an action through the UI, then the list updates in stable order and the completed action becomes read only.
- **AC-04**: Given a performer that is inactive or a Requester, when an action is created or reassigned to them, then the API returns 400 and nothing is saved.
- **AC-05**: Given a Requester, when they call any action write endpoint, then the API returns 403; when they view their own Ticket, all its actions are visible read only; for another Requester's Ticket they get 404.
- **AC-06**: Given Follow-Up Required = true and an empty Follow-Up Note, or Completed with empty Result, when saved, then the API returns 400 with field errors and the UI keeps the entered data.
- **AC-07**: Given a Ticket that is Closed or Cancelled, when an action is created or edited, then the API returns 409 and nothing changes.
- **AC-08**: Given a status change not in the matrix, or by a Requester, then the API returns 400 or 403 and the status is unchanged; permitted changes succeed and add exactly one history row.
- **AC-09**: Given a Ticket without an Owner, without a Completed action, or with a Planned action, when IT Staff set it to Resolved, then the API returns 409 RESOLUTION_GATE_FAILED with the reasons.
- **AC-10**: Given two users editing the same Ticket or action, when the second saves with an old version, then the API returns 409 STALE_UPDATE and the first user's change is kept.
- **AC-11**: Given the same `clientRequestId` sent twice, then only one action exists.
- **AC-12**: Given a Requester marks "appears resolved", then status is unchanged, the flag is set, and the Ticket appears in IT Staff `appearsResolved`.
- **AC-13**: Given IT Staff, when the staff dashboard is retrieved, then each count equals the documented query on the seeded data, and a Requester calling it gets 403.
- **AC-14**: Given an Administrator, the staff dashboard also includes user counts; an IT Staff user does not receive them.
- **AC-15**: Given a dashboard card or list item is clicked, then the user lands on the matching filtered list or Ticket Detail.
- **AC-16**: Given a user with no matching data, dashboards show zeros and empty states without errors.
- **AC-17**: Given the Lab 3 database, when the Lab 4 migration runs, then all existing row counts are unchanged and every Ticket has one history row.
- **AC-18**: Given the full Lab 1 to 3 regression suite, when run on the Lab 4 main branch, then all tests pass.
- **AC-19**: Given desktop, tablet, and mobile widths, all Lab 4 screens have no clipping, overlap, or horizontal page scroll, with visible keyboard focus and non-color status cues.

## 10. Definition of Done (Product)
- [ ] specification.md, ui-spec.md, api-spec.md, tests.md committed and merged before the first implementation PR.
- [ ] All Sprint 4 GitHub Issues are Done, each merged by PR into `lab4-staging`, then `lab4-staging` into `main`.
- [ ] Prisma migration applies cleanly on a Lab 3 database and on an empty database; seed runs twice without duplicates.
- [ ] Every AC maps to at least one passing automated test listed in tests.md with its real file path.
- [ ] Every write operation is authorized on the backend; no rule relies on hidden UI controls.
- [ ] All Lab 1 to 3 server, client, and E2E tests pass on `main`.
- [ ] Dashboard counts verified against SQL on seeded data (evidence saved for Part 5).
- [ ] Desktop, tablet, mobile screenshots saved in `artifacts/lab-04/screenshots/` for dashboards and Actions Taken.
- [ ] No console errors, placeholder text, dead links, unfinished controls, or the old "Check System" landing view.
- [ ] README updated for setup, migration, seed, tests, and demo accounts.
- [ ] ai-use.md and reviewer.md completed.

## 11. Assumptions and Decisions
- **Action lifecycle**: The handout lists fields but also asks for assign, complete, and cancel. We model each action as Planned until completed, so IT Staff can plan work and then record the outcome. "Performed by (auto)" means it defaults to the current user; reassigning the performer is how an action is "assigned".
- **Appears Resolved is advisory** (handout 4.5): Lab 3 moved the Ticket to In Progress; Lab 4 replaces that with a flag. Lab 3 tests for that endpoint are updated, not deleted.
- **Cancelled is terminal for IT Staff**; only an Administrator may reopen a cancelled Ticket (recovery for mistakes).
- **No day-over-day deltas** on dashboard cards; they need daily snapshots, which is closer to BI than to a concise dashboard.
- **IT Priority on creation**: Lab 3 BR-12 (IT Priority starts as a copy of Requested Priority) was documented but never implemented; Lab 4 implements it in `POST /api/tickets`.
- **Time zone**: all date boundaries use Asia/Bangkok; timestamps are stored in UTC and shown in local time.
- **Navigation**: the app keeps its view-state navigation; drill-down opens a view with initial filters rather than adding a router.
