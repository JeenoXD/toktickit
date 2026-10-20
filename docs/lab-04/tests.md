# Lab 4 Test Plan and Results

## 1. Test Strategy
Tests are written from `specification.md` before or alongside each Issue (TDD: failing test first, minimum code, refactor). Levels: unit, API/integration, authorization, workflow, migration/regression, UI component, UI style/responsive, accessibility, performance smoke, and E2E. Every AC maps to at least one automated test. The full Lab 1 to 3 suites stay in place and must pass on `main`. "Final" is filled in when the test actually passes on `main`.

## 2. Planned Tests
| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-14, BR-15, BR-17 | Transition/gate helper for every from/to pair and role | Matches the matrix exactly; gate reasons correct | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-06 to BR-09 | Action validation helper | Field errors for each rule; trims input | `server/tests/lab-04/actions-taken.unit.test.ts` | Pending |
| UNIT-03 | Unit | BR-22, BR-23 | Bangkok "recent" window boundary | Window starts 00:00 UTC+7 six days ago | `server/tests/lab-04/dashboard.unit.test.ts` | Pending |
| API-01 | API | AC-01 | IT Staff creates action with defaults | 201; `createdById` and `performedById` = self, status Planned | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-02 | API | AC-01, BR-02 | Create action performed by another active staff | 201; performer = chosen user, creator = self | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-03 | API | AC-04 | Performer inactive or Requester | 400; no row created | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-04 | API | AC-05 | Requester POST/PATCH action | 403 | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-05 | API | AC-05, FR-04 | Requester lists own vs other Ticket actions | 200 with all actions / 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-06 | API | AC-06 | Follow-up without note; complete without result; empty description | 400 with `fields` | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-07 | API | BR-09 | actionAt before Ticket creation; completed far in future | 400 | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-08 | API | BR-05, FR-02, FR-03 | Edit Planned, complete, cancel; edit Completed | 200, 200, 200; then 400 `ACTION_NOT_EDITABLE` | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-09 | API | AC-07 | Action create/edit on Closed or Cancelled Ticket | 409 `TICKET_LOCKED` | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-10 | API | AC-10 | Action edit with stale version | 409 `STALE_UPDATE`; first change kept | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-11 | API | AC-11 | Same `clientRequestId` twice | 201 then 200; one row | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-12 | API | BR-12 | List order with equal `actionAt` | Ordered by actionAt then id | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-13 | Workflow | AC-08 | Every permitted transition succeeds; sample forbidden ones fail | 200 / 400; status unchanged on fail | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-14 | Authorization | AC-08 | Requester PATCH status; IT Staff Cancelled→Reopened | 403 / 403; Admin 200 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-15 | Workflow | AC-09 | Resolve without owner / completed action / with planned action | 409 with each reason | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-16 | Workflow | BR-16, BR-17 | Cancel with planned actions; In Progress without owner | 409 / 400 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-17 | Workflow | BR-18 | History append-only and ordered | One row per change; no write endpoint | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-18 | Concurrency | AC-10 | Two status changes with same version | First 200, second 409 with `current` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-19 | Workflow | AC-12 | Requester appears-resolved | 200; status unchanged; flag set; idempotent | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-20 | API | AC-02, AC-16 | Requester dashboard: own data only; zero user | Counts equal SQL; other users excluded; zeros and `[]` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-21 | Authorization | AC-02 | Staff calls requester dashboard; requester sends `requesterId` | 403; param ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-22 | API | AC-13 | Staff dashboard counts vs Prisma/SQL on seed | Every metric matches | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-23 | Authorization | AC-13, AC-14 | Requester 403; IT Staff no `users`; Admin has `users` | As stated | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-24 | API | FR-10 | Queue/My Tickets drill-down filters | Filtered results equal dashboard counts | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| PERF-01 | Perf smoke | FR-09 | Dashboards with 500 extra Tickets | Each response < 500 ms locally | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| MIG-01 | Migration | AC-17 | Lab 3 data before/after migration | Row counts equal; each Ticket has 1 history row | `server/tests/lab-04/migration.test.ts` | Pending |
| MIG-02 | Seed | Section 7 | Seed run twice | No duplicates; required coverage present | `server/tests/lab-04/migration.test.ts` | Pending |
| REG-01 | Regression | AC-18 | Lab 1 to 3 server suites (requester-resolved test updated for BR-19) | All pass | `server/tests/lab-01..03/*` | Pending |
| UI-01 | UI | FR-09, AC-15 | StaffDashboard renders cards, empty, error, drill-down callback | Correct labels, zeros, filters passed | `client/tests/lab-04/StaffDashboard.test.tsx` | Pending |
| UI-02 | UI | AC-14 | Admin sees user-account card; IT Staff does not | As stated | `client/tests/lab-04/StaffDashboard.test.tsx` | Pending |
| UI-03 | UI | FR-08, AC-16 | RequesterDashboard cards, lists, empty new user, retry | As specified | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pending |
| UI-04 | UI | AC-03, AC-06 | ActionsTaken create/edit/complete/cancel, follow-up note toggling, field errors keep input | As specified | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-05 | UI | FR-13 | ActionsTaken double click sends one request; 409 shows Reload | One POST; conflict message | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-06 | UI | FR-04 | Requester view is read only | No edit controls | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-07 | UI | FR-05 | Status select shows only allowed; blocked reasons shown | As specified | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pending |
| UI-08 | UI | FR-11 | Dashboard is landing view; active nav `aria-current` | As specified | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pending |
| REG-02 | Regression | AC-18 | Lab 1 to 3 client suites | All pass | `client/tests/lab-0{1,2,3}/*` | Pending |
| E2E-01 | E2E | AC-01, AC-03 | Staff adds two actions by different performers, edits one, completes, cancels | Both visible in order; completed read only | `e2e/lab-04/actions-taken-flow.spec.ts` | Pending |
| E2E-02 | E2E | AC-09, AC-08 | Resolve blocked, add completed action, resolve, close; requester sees work | Gate message then success; history shows steps | `e2e/lab-04/ticket-resolution.spec.ts` | Pending |
| E2E-03 | E2E | AC-12 | Requester appears-resolved, staff sees banner and resolves | Status unchanged until staff acts | `e2e/lab-04/ticket-resolution.spec.ts` | Pending |
| E2E-04 | E2E | AC-13, AC-15 | Staff and requester dashboards counts and drill-down | Counts match list totals | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-05 | E2E | AC-18 | Lab 2 and 3 E2E specs | All pass | `e2e/lab-02/*`, `e2e/lab-03/*` | Pending |
| RESP-01 | Responsive / A11y | AC-19 | Staff dashboard 1280/820/390 | No clipping, overlap, h-scroll | `artifacts/lab-04/screenshots/staff-dashboard/` | Pending |
| RESP-02 | Responsive / A11y | AC-19 | Requester dashboard 1280/820/390 | Same | `artifacts/lab-04/screenshots/requester-dashboard/` | Pending |
| RESP-03 | Responsive / A11y | AC-19 | Actions Taken list, create, edit (staff) and read only (requester) | Same | `artifacts/lab-04/screenshots/actions-taken/` | Pending |
| A11Y-01 | Accessibility | AC-19 | Keyboard-only pass and no horizontal overflow check in Playwright | Focus visible; `scrollWidth <= clientWidth` | `e2e/lab-04/dashboards.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability
| AC | Covered By |
| --- | --- |
| AC-01 | API-01, API-02, E2E-01 |
| AC-02 | API-20, API-21 |
| AC-03 | UI-04, E2E-01 |
| AC-04 | API-03 |
| AC-05 | API-04, API-05, UI-06 |
| AC-06 | API-06, UI-04 |
| AC-07 | API-09 |
| AC-08 | UNIT-01, API-13, API-14, E2E-02 |
| AC-09 | UNIT-01, API-15, E2E-02 |
| AC-10 | API-10, API-18, UI-05 |
| AC-11 | API-11, UI-05 |
| AC-12 | API-19, E2E-03 |
| AC-13 | API-22, API-23, E2E-04 |
| AC-14 | API-23, UI-02 |
| AC-15 | API-24, UI-01, E2E-04 |
| AC-16 | API-20, UI-03 |
| AC-17 | MIG-01, MIG-02 |
| AC-18 | REG-01, REG-02, E2E-05 |
| AC-19 | RESP-01, RESP-02, RESP-03, A11Y-01 |

## 4. Test Commands
- Server: `cd server && npm test`
- Client: `cd client && npm test`
- E2E: `cd e2e && npx playwright test`
