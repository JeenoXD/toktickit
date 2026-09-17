# Lab 3 Test Plan and Results

## 1. Test Strategy
Tests are planned from `specification.md` before implementation, per Issue, following TDD: write the failing test tied to an Issue's Acceptance Criteria first, implement the minimum code to pass it, then refactor. Levels covered: unit, API/integration, UI component, UI style/responsive, security/authorization, migration/regression, and E2E. Every AC maps to at least one automated test.

## 2. Planned Tests
| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-06 | Password hashing utility | Returns bcrypt hash, never plaintext | `server/tests/lab-03/auth.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Valid login | 200; HTTP-only cookie set; safe user data returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-02 | Login with `requiresPasswordChange=true` | 200; user object has flag=true; subsequent `/me` redirects or flags | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | BR-03, FR-03 | Requester fetches another's ticket | 403/404; ticket data not returned | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-04 | API | AC-04 | Requester requests Internal Notes | 403 Forbidden; no note data returned | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-05 | API | FR-04, AC-06 | IT Staff fetches queue with filters | 200; returns filtered, sorted, paginated data | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-06 | API | FR-04 | IT Staff claims ticket | 200; ticket `ownerId` updated to IT Staff user ID | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-07 | API | BR-07 | Admin attempts to deactivate self | 400 Bad Request; safe error message | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-08 | API | BR-08 | Admin attempts to deactivate last active admin | 400 Bad Request; safe error message | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-09 | API | BR-09 | Admin creates user with duplicate email | 409 Conflict | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-10 | API | Migration | Lab 2 Requester data migrated to User | Existing tickets still link to migrated User records | `server/tests/lab-03/migration.api.test.ts` | Pass |
| UI-01 | UI | AC-01, AC-02 | Login and mandatory password change flow | Redirects to change password; blocks other routes until complete | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | FR-03 | Requester Ticket Detail shows Public Comments | Comments render; Internal Notes section is hidden | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass |
| UI-03 | UI | FR-04 | IT Staff Queue renders filters and pagination | Controls render; API called with correct query params | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-04 | UI | FR-05 | IT Staff Detail shows Internal Notes input | Input renders; submits to `/notes` endpoint | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-05 | UI | FR-07 | Admin User Management prevents self-deactivation | Deactivate button disabled or returns safe error for self | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| RESP-01 | Responsive | Section 8.7 | Login & Change Password at all breakpoints | No clipping/overlap; usable on mobile | Playwright screenshots, `artifacts/lab-03/screenshots/authentication/` | Pass |
| RESP-02 | Responsive | Section 8.7 | IT Staff Queue at desktop/tablet/mobile | Table/card layout switches correctly, no overflow | Playwright screenshots, `artifacts/lab-03/screenshots/staff-queue/` | Pass |
| RESP-03 | Responsive | Section 8.7 | Admin User Management at all breakpoints | Modals and lists remain usable on mobile | Playwright screenshots, `artifacts/lab-03/screenshots/user-management/` | Pass |
| E2E-01 | E2E | AC-01, AC-02 | First login and mandatory password change | User logs in, is forced to change password, then accesses app | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | FR-04, FR-05 | IT Staff claims ticket and adds internal note | Ticket owner updates; note visible to IT Staff, hidden from Requester | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-03 | E2E | FR-07 | Admin creates user and sets initial password | User appears in list; new user can log in and is forced to change password | `e2e/lab-03/user-administration.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability
| AC | Covered By |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-01, E2E-01 |
| AC-03 | API-03, E2E-02 |
| AC-04 | API-04, UI-02, E2E-02 |
| AC-05 | API-07, API-08, UI-05 |
| AC-06 | API-05, UI-03, E2E-02 |
| AC-07 | API-06, UI-04, E2E-02 |

## 4. Responsive and Visual Checklist
- [x] No clipped labels at any breakpoint
- [x] No overlapping validation messages
- [x] No unintended horizontal scrolling
- [x] Editable vs read-only fields are visually distinct per `ui-spec.md`
- [x] Priority/Status/Role badges are consistent across all screens
- [x] Internal Notes are visually distinct from Public Comments (e.g., different background color/icon)
- [x] Screenshots match `ui-spec.md` and approved illustrations

## 5. Test Commands
# Backend
cd server
npm test

# Frontend
cd client
npm test

# E2E (Playwright)
cd e2e
npm test

## 6. Final Results
All planned tests pass on the final `main` branch as of the Lab 3 release. *(Paste your actual terminal output or screenshots here as submission evidence per Part 3 of the labsheet.)*

## 7. Known Limitations or Deferred Tests
- Migration tests verify foreign key integrity, but do not test massive datasets (scaled to Lab 3 seed data size).
- Playwright E2E tests run with `workers: 1` to prevent race conditions during user creation and ticket claiming in the shared test database.