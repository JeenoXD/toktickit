# Lab 4 UI Specification

## 1. Design Language
- **Theme**: Zen Green unchanged from Labs 2 and 3 (`#006B3C` primary, `#E8F5E9` surfaces, `#D32F2F` errors, Internal Notes `#FFF8E1`). Reuse existing cards, badges, buttons, forms, tables, alerts, loading, empty, and error components; no new visual style.
- **Breakpoints**: Desktop ≥992px, Tablet 768 to 991px, Mobile <768px. No horizontal page scroll at any width.
- **Status badges** always show readable text plus color (never color alone or raw codes such as `IN_PROGRESS`), in Ticket Detail, My Tickets, the queue, and dashboards. The nav shows the role as "IT Staff" rather than `IT_STAFF`. Action status uses the same badge component: Planned (outline), Completed (green), Cancelled (grey, struck label "Cancelled").
- **Shared vs private**: Actions Taken and Public Comments are visible to the Requester and carry a small "Visible to requester" label on the staff screen; Internal Notes keep the yellow panel and a "Staff only" label.

## 2. Navigation Shell
- Nav order. Requester: Dashboard, My Tickets, Create Ticket. IT Staff: Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User Management. Then user name, role, Sign Out.
- Dashboard is the default view after sign-in and after password change. The Lab 1 "Check System" view is removed from the nav; its health check moves to a "System status" card on the Administrator dashboard so the Lab 1 feature keeps working.
- Active item uses `aria-current="page"` plus an underline (not color only).
- Mobile: nav items wrap onto extra lines (no hidden menu), each at least 44px tall.

## 3. IT Staff / Administrator Dashboard
- **Header**: "Welcome back, {name}", subtitle, Refresh button (disabled while loading).
- **Metric cards** (5 desktop columns, 2 tablet, 1 to 2 mobile): Unassigned, My Assigned, Waiting for Requester, Appears Resolved, My Planned Actions. Each card is a single `<button>` with an accessible name like "Unassigned tickets: 4, view list". Clicking opens Ticket Queue with the API's drill-down filters, shown as removable filter chips.
- **Breakdown**: "Tickets by status" and "Active tickets by IT Priority" as compact labeled count rows; each row drills to the queue filtered on that value.
- **Lists**: Urgent (High priority), Recently Updated, My Planned Actions. Each row shows ticket number, summary (truncated with full text in `title`), status badge, time; clicking opens Ticket Detail. "View all" links to the matching queue filter.
- **Quick Actions**: My Queue (active, owner = me) and Search All Tickets (full queue).
- **Administrator only**: "User accounts" card with active counts per role and inactive count, linking to User Management.
- **States**: loading skeleton cards; per-list empty text ("No urgent tickets right now"); zeros shown as "0", not blank; safe failure banner "Dashboard could not be loaded" with Retry; Requester never sees this view (403 shows the forbidden panel).

## 4. Requester Dashboard
- **Header**: "Welcome, {name}" and "Here's the latest on your requests."
- **Cards**: My Open Tickets, Waiting for Me, Resolved, Closed, each with "View all" opening My Tickets filtered accordingly. "Waiting for Me" is highlighted when count > 0 ("Needs your reply").
- **Lists**: Recently Updated (5), Recently Resolved (last 7 days, 5). Row opens Requester Ticket Detail.
- **Quick Actions**: Create Ticket, View My Tickets.
- **States**: loading skeleton; new user with no Tickets sees all zeros plus an empty panel "You haven't submitted any tickets yet" with a Create Ticket button; safe failure banner with Retry.

## 5. Actions Taken on IT Staff Ticket Detail
- Placed below ticket info and above Public Comments, in a card titled "Actions Taken ({count})".
- **List mode**: Desktop table (Date/Time, Description, Result, Performed by, Follow-up, Status, actions menu). Tablet and mobile: stacked cards with the same fields as labeled rows. Stable order oldest first. Follow-up rows show a "Follow-up" badge with the note. Attachment Notes shown under the description with a paperclip icon and text.
- **Create mode**: "Add Action" button opens an inline form: Action Date/Time (`datetime-local`, default now), Description (required), Result (optional), Performed by (select of active staff, default "Me"), Follow-Up Required (checkbox), Follow-Up Note (appears and becomes required when checked), Attachment Notes. Buttons: Save as Planned, Save and Complete, Cancel.
- **View/Edit mode**: every row is shown read only. Planned rows have Edit, Complete, and Cancel buttons; Edit opens the same form prefilled above the list. Completed and Cancelled rows are view only with no edit controls.
- **Complete** opens an inline panel above the list asking for Result (required). **Cancel** opens an inline confirmation panel. Inline panels are used instead of modal dialogs so focus never gets trapped and the page stays usable at every width.
- **Feedback**: field errors under each field with `aria-describedby`; Save button shows a spinner and is disabled while saving (prevents double submit; a `clientRequestId` is generated once per form open); success toast "Action saved"; 409 STALE_UPDATE shows "This action was changed by someone else" with Reload (form text is kept until reload); 409 TICKET_LOCKED shows "This ticket is closed; actions are read only"; network failure keeps the form filled with Retry.
- Ticket Closed or Cancelled: Add/Edit controls hidden and a note explains why.

### 5.1 Attachments on IT Staff Ticket Detail
- Read-only card above Actions Taken listing each attachment with a download link and size. Removed attachments are struck through with a "Removed" badge and the reason. Upload and removal stay Requester-only (Lab 2).

## 6. Actions Taken on Requester Ticket Detail
- Same card, read only, titled "Work done on this ticket". Shows Date/Time, Description, Result, Performed by, Follow-up note, Status. No buttons. Empty state: "IT Staff haven't recorded any actions yet."

## 7. Ticket Workflow Controls (IT Staff Detail)
- Status select lists only `allowed` transitions from `/allowed-transitions`. Options with `blockedBy` are disabled with reason text, e.g. "Resolved — needs at least one completed action".
- Change requires a Confirm button (no change on select alone). On success, status badge, history timeline, dashboard data, and `version` refresh.
- "Requester says this appears resolved" banner appears when `requesterResolvedAt` is set.
- Status history timeline (both Ticket Detail screens): from → to, who, when, oldest first.
- Requester Detail: "Problem Appears Resolved" button becomes "You marked this as appearing resolved on {date}" after use, status badge unchanged.

## 8. Hardening Checklist (verified in Issue 6)
- [x] Every form disables submit while pending and keeps input after a failed request.
- [x] Loading, empty, no-results, forbidden (403), not-found (404), conflict (409), and failure states use the shared alert components.
- [x] No console errors or React key warnings on any screen.
- [x] No placeholder text, dead buttons, or leftover Dev Requester / Check System UI.
- [x] Keyboard: every control reachable by Tab in reading order, visible focus ring, Enter/Space activate cards.
- [x] Touch targets ≥44px tall on mobile (nav tabs and every `btn-sm` get `min-height: 44px` below 768px in `client/src/app.css`).
- [x] Labels on all inputs; read-only fields rendered as text, not disabled inputs.
- [x] Long summaries and descriptions wrap or truncate without overlapping.
- [x] Contrast WCAG AA: Zen Green `#006B3C` on white is about 6.6:1; status badges use Bootstrap colors with dark text on light/yellow backgrounds.
- [x] Screenshots at 1280, 820, 390 px for Staff Dashboard, Admin Dashboard, Requester Dashboard (with and without tickets), Staff Ticket Detail with actions (list, create) and workflow, Requester Ticket Detail with actions and history (`artifacts/lab-04/screenshots/`).
