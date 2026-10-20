# Lab 4 UI Specification

## 1. Design Language
- **Theme**: Zen Green unchanged from Labs 2 and 3 (`#006B3C` primary, `#E8F5E9` surfaces, `#D32F2F` errors, Internal Notes `#FFF8E1`). Reuse existing cards, badges, buttons, forms, tables, alerts, loading, empty, and error components; no new visual style.
- **Breakpoints**: Desktop ≥992px, Tablet 768 to 991px, Mobile <768px. No horizontal page scroll at any width.
- **Status badges** always show text plus color (never color alone). Action status uses the same badge component: Planned (outline), Completed (green), Cancelled (grey, struck label "Cancelled").
- **Shared vs private**: Actions Taken and Public Comments are visible to the Requester and carry a small "Visible to requester" label on the staff screen; Internal Notes keep the yellow panel and a "Staff only" label.

## 2. Navigation Shell
- Nav order. Requester: Dashboard, My Tickets, Create Ticket. IT Staff: Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User Management. Then user name, role, Sign Out.
- Dashboard is the default view after sign-in and after password change. The Lab 1 "Check System" view is removed from the nav.
- Active item uses `aria-current="page"` plus an underline (not color only).
- Mobile: nav collapses into a toggle button with `aria-expanded`.

## 3. IT Staff / Administrator Dashboard
- **Header**: "Welcome back, {name}", subtitle, Refresh button (disabled while loading).
- **Metric cards** (5 desktop columns, 2 tablet, 1 to 2 mobile): Unassigned, My Assigned, Waiting for Requester, Appears Resolved, My Planned Actions. Each card is a single `<button>` with an accessible name like "Unassigned tickets: 4, view list". Clicking opens Ticket Queue with the API's drill-down filters, shown as removable filter chips.
- **Breakdown**: "Tickets by status" and "Active tickets by IT Priority" as compact labeled count rows; each row drills to the queue filtered on that value.
- **Lists**: Urgent (High priority), Recently Updated, My Planned Actions. Each row shows ticket number, summary (truncated with full text in `title`), status badge, time; clicking opens Ticket Detail. "View all" links to the matching queue filter.
- **Quick Actions**: Ticket Queue, My Queue (owner=me).
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
- **View/Edit mode**: clicking a Planned row expands it read-only with Edit, Complete, Cancel Action buttons. Edit switches the same fields to inputs. Completed and Cancelled rows are view only with no edit controls.
- **Complete** opens a small dialog asking for Result if empty. **Cancel Action** asks for confirmation. Dialogs trap focus, close on Escape, and return focus to the trigger.
- **Feedback**: field errors under each field with `aria-describedby`; Save button shows a spinner and is disabled while saving (prevents double submit; a `clientRequestId` is generated once per form open); success toast "Action saved"; 409 STALE_UPDATE shows "This action was changed by someone else" with Reload (form text is kept until reload); 409 TICKET_LOCKED shows "This ticket is closed; actions are read only"; network failure keeps the form filled with Retry.
- Ticket Closed or Cancelled: Add/Edit controls hidden and a note explains why.

## 6. Actions Taken on Requester Ticket Detail
- Same card, read only, titled "Work done on this ticket". Shows Date/Time, Description, Result, Performed by, Follow-up note, Status. No buttons. Empty state: "IT Staff haven't recorded any actions yet."

## 7. Ticket Workflow Controls (IT Staff Detail)
- Status select lists only `allowed` transitions from `/allowed-transitions`. Options with `blockedBy` are disabled with reason text, e.g. "Resolved — needs at least one completed action".
- Change requires a Confirm button (no change on select alone). On success, status badge, history timeline, dashboard data, and `version` refresh.
- "Requester says this appears resolved" banner appears when `requesterResolvedAt` is set.
- Status history timeline (both Ticket Detail screens): from → to, who, when, oldest first.
- Requester Detail: "Problem Appears Resolved" button becomes "You marked this as appearing resolved on {date}" after use, status badge unchanged.

## 8. Hardening Checklist
- [ ] Every form disables submit while pending and keeps input after a failed request.
- [ ] Loading, empty, no-results, forbidden (403), not-found (404), conflict (409), and failure states use the shared alert components.
- [ ] No console errors or React key warnings on any screen.
- [ ] No placeholder text, dead buttons, or leftover Dev Requester / Check System UI.
- [ ] Keyboard: every control reachable by Tab in reading order, visible focus ring, Enter/Space activate cards.
- [ ] Touch targets ≥44×44px on mobile.
- [ ] Labels on all inputs; read-only fields rendered as text, not disabled inputs.
- [ ] Long summaries and descriptions wrap or truncate without overlapping.
- [ ] Contrast WCAG AA for text and badges.
- [ ] Screenshots at 1280, 820, 390 px for Staff Dashboard, Admin Dashboard, Requester Dashboard, Staff Ticket Detail with actions (list, create, edit), Requester Ticket Detail with actions.
