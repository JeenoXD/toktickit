# Lab 3 Test Plan and Results

## 1. Test Strategy
Tests are planned from `specification.md` before implementation, per Issue, following TDD: write the failing test tied to an Issue's Acceptance Criteria first, implement the minimum code to pass it, then refactor. Levels covered: unit, API/integration, UI component, UI style/responsive, security/authorization, migration/regression, and E2E. Every AC maps to at least one automated test.

## 2. Planned Tests
| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-06 | Password hashing and strength validation | Returns bcrypt hash, never plaintext; rejects weak passwords | `server/tests/lab-03/auth.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Valid login | 200; HTTP-only cookie set; safe user data returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-02 | Login with `requiresPasswordChange=true` | 200; user object has flag=true | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | BR-01 | Inactive account login attempt | 401; generic message, no account existence leaked | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | BR-14 | Logout invalidates session | 200; subsequent `/me` with the same cookie returns 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | BR-15 | `/me` behavior | 200 with current user when authenticated; 401 when not | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | BR-03, FR-03 | Requester fetches another's ticket | 404; ticket data not returned, existence not revealed | `server/tests/lab-03/requester-regression.api.test.ts` | Pass |
| API-07 | API | AC-04 | Requester requests Internal Notes | 403 Forbidden; no note data returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-08 | API | BR-05 | Requester marks ticket "appears resolved" | 200; status moves to In Progress (not Resolved/Closed) | `server/tests/lab-03/requester-regression.api.test.ts` | Pass |
| API-09 | API | BR-05 | "Appears resolved" rejected once ticket is Resolved/Closed/Cancelled | 400; status unchanged | `server/tests/lab-03/requester-regression.api.test.ts` | Pass |
| API-10 | API | FR-04, FR-04 | IT Staff fetches queue with search/filter/sort/pagination | 200; returns filtered, sorted, paginated data with metadata | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-11 | API | FR-04 | Requester attempts to access queue | 403 Forbidden | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-12 | API | FR-04 | IT Staff claims and reassigns a ticket | 200; `ownerId` updates to the claiming/reassigned user | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-13 | API | BR-12 | Ticket creation copies Requested Priority into IT Priority | 201; `itPriority` equals submitted `requestedPriority` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-14 | API | BR-10 | IT Priority update and status transition validation | 200 on valid transition; 400 on invalid transition | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-15 | API | BR-04 | Internal Notes creation/retrieval, blocked for Requesters | 201/200 for IT Staff/Admin; 403 for Requester | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-16 | API | FR-07 | Admin lists users with search and role filter | 200; filtered results | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-17 | API | BR-09 | Admin creates user with duplicate email / invalid role | 409 on duplicate email; 400 on invalid role | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-18 | API | FR-07 | Admin edits and resets a user's password | 200; `requiresPasswordChange` set true on reset | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-19 | API | BR-07 | Admin attempts to deactivate self | 400 Bad Request; safe error message | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-20 | API | BR-08 | Admin attempts to deactivate last active admin | 400 Bad Request; safe error message | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| UI-01 | UI | AC-01, AC-02 | Login and mandatory password change flow | Redirects to change password; blocks other routes until complete | `client/tests/lab-03/Login.test.tsx`, `ChangePassword.test.tsx` | Pass |
| UI-02 | UI | FR-03 | Requester Ticket Detail shows Public Comments | Comments render (via `ticket.publicComments`); Internal Notes hidden | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass |
| UI-03 | UI | FR-04 | IT Staff Queue renders filters and pagination | Controls render; API called with correct query params | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-04 | UI | FR-05 | IT Staff Detail shows Internal Notes input, visually distinct from Public Comments | Input renders; submits to `/notes`; distinct styling present | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-05 | UI | FR-07 | Admin User Management prevents self-deactivation | Safe error shown for self-deactivation attempt | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| E2E-01 | E2E | AC-01, AC-02 | First login and mandatory password change | User logs in, is forced to change password, then accesses app; new password works afterward | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | FR-04 | IT Staff queue search/filter/sort/pagination | Search, IT Priority filter, status filter, sort (desktop only, see Known Limitations), and pagination all work | `e2e/lab-03/ticket-queue.spec.ts` | Pass |
| E2E-03 | E2E | FR-04, FR-05 | IT Staff claims ticket and adds internal note | Ownership updates; note visible to IT Staff, distinct from comments | `e2e/lab-03/claim-and-note.spec.ts` | Pass |
| E2E-04 | E2E | BR-10 | IT Staff status transition workflow | Invalid transition rejected; valid chain (New→Open→In Progress→Resolved→Closed) succeeds | `e2e/lab-03/status-transitions.spec.ts` | Pass |
| E2E-05 | E2E | FR-07 | Admin creates user and verifies password change requirement | User created, duplicate email rejected, new user forced to change password on first login | `e2e/lab-03/admin-create-user.spec.ts` | Pass |
| E2E-06 | E2E | FR-06 | Requester regression: create ticket, view in My Tickets, add public comment | Full flow works under authenticated identity; comment appears (regression-tests the `publicComments` field fix) | `e2e/lab-03/requester-regression.spec.ts` | Pass |
| E2E-07 | E2E | BR-03 | Authorization: Requester cannot access IT/Admin features | Nav items hidden; direct API calls to queue/users return 403 | `e2e/lab-03/authorization.spec.ts` | Pass |
| RESP-01 | Responsive | Section 8.7 | Login screen, desktop/tablet/mobile | No clipping/overlap; usable on mobile | `artifacts/lab-03/screenshots/authentication/login/` | Pass |
| RESP-02 | Responsive | Section 8.7 | Change Password screen, desktop/tablet/mobile | No clipping/overlap; usable on mobile | `artifacts/lab-03/screenshots/authentication/change-password/` | Pass |
| RESP-03 | Responsive | Section 8.7 | IT Staff Ticket Queue, desktop/tablet/mobile | Table (desktop) / card (tablet, mobile) layout switches correctly | `artifacts/lab-03/screenshots/it-staff/ticket-queue/` | Pass |
| RESP-04 | Responsive | Section 8.7 | IT Staff Ticket Detail, desktop/tablet/mobile | Comments/Notes sections remain distinct and usable at all sizes | `artifacts/lab-03/screenshots/it-staff/ticket-detail/` | Pass |
| RESP-05 | Responsive | Section 8.7 | Administrator User Management, desktop/tablet/mobile | List and modals remain usable on mobile | `artifacts/lab-03/screenshots/admin/user-management/` | Pass |
| RESP-06 | Responsive | Section 8.7 | Requester Create Ticket, desktop/tablet/mobile | Form usable at all sizes | `artifacts/lab-03/screenshots/requester/create-ticket/` | Pass |
| RESP-07 | Responsive | Section 8.7 | Requester My Tickets, desktop/tablet/mobile | Table/card layout switches correctly | `artifacts/lab-03/screenshots/requester/my-tickets/` | Pass |
| RESP-08 | Responsive | Section 8.7 | Requester Ticket Detail, desktop/tablet/mobile | Comments section usable at all sizes | `artifacts/lab-03/screenshots/requester/ticket-detail/` | Pass |

## 3. Acceptance-Criterion Traceability
| AC | Covered By |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-01, E2E-01 |
| AC-03 | API-06, E2E-06 |
| AC-04 | API-07, UI-02, API-15, E2E-03 |
| AC-05 | API-19, API-20, UI-05 |
| AC-06 | API-10, API-11, UI-03, E2E-02 |
| AC-07 | API-12, API-13, API-14, E2E-03, E2E-04 |

## 4. Responsive and Visual Checklist
- [x] No clipped labels at any breakpoint
- [x] No overlapping validation messages
- [x] No unintended horizontal scrolling
- [x] Editable vs read-only fields are visually distinct per `ui-spec.md`
- [x] Priority/Status/Role badges are consistent across all screens
- [x] Internal Notes are visually distinct from Public Comments (light-yellow background vs. plain list)
- [x] All interactive elements meet the 44x44px minimum touch target on mobile
- [x] Color contrast meets WCAG AA (Zen Green on white)
- [x] Screenshots match `ui-spec.md` and approved illustrations

## 5. Test Commands

Backend (unit + API)

cd server
npm test

Frontend (UI component)

cd client
npm test

E2E + responsive screenshots (Playwright, runs lab-02 and lab-03 together)

cd e2e
npx playwright test


## 6. Final Results
All planned tests pass on the final `main` branch as of the Lab 3 release. *(Paste your actual terminal output or screenshots here as submission evidence per Part 3 of the labsheet.)*

## 7. Known Limitations or Deferred Tests
- The IT Staff Ticket Queue has no sort control below Bootstrap's `lg` breakpoint (992px): sorting is a column-header interaction that only exists in the desktop table layout, the mobile/tablet card layout has search and both filters but no sort equivalent. E2E-02 explicitly skips the sort assertion on tablet/mobile with a documented reason rather than silently omitting coverage; this is a genuine product decision worth revisiting, not a test gap.
- Playwright E2E tests reseed the database once per viewport project (desktop, tablet, mobile) rather than once per test, using chained `reset-*` setup projects in `playwright.config.ts`. This keeps a full run fast while still guaranteeing each viewport starts from a known-clean state.
- Migration tests verify foreign key integrity but do not test at production data scale.