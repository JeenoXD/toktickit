# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal
Replace the temporary Development Requester selector with secure, role-based authentication and authorization. Deliver the first operational IT Staff ticket workflow (Queue, Detail, Claims, Priority, Comments/Notes) and a minimalist Administrator user management screen, while preserving all Lab 2 Requester functionality and migrating existing data.

## 2. Stakeholder Request Interpretation
The IT department needs real users with secure login. Administrators must manage basic user accounts (create, edit, assign one role, activate/deactivate, reset initial password). Requesters must use their authenticated identity for Lab 2 features and can now add Public Comments and flag tickets as "Appears Resolved". IT Staff need a professional queue to claim work, set IT Priority, update statuses, and communicate via Public Comments and private Internal Notes. All API/screen access must be protected by server-side authorization.

## 3. Scope
**Included:**
- Secure authentication (email/password), logout, current-user retrieval, mandatory first-login password change.
- Role-based navigation and server-side authorization (Requester, IT Staff, Administrator).
- Migration of Lab 2 Development Requester to the real User model.
- IT Staff Ticket Queue (search, filter, sort, paginate) and Ticket Detail operations (claim, assign, IT Priority, status transitions, Public Comments, Internal Notes).
- Requester "Problem Appears Resolved" indication.
- Minimalist Administrator user management (list, search, create, edit, role assignment, activation, initial password set).

**Explicitly Excluded:**
- Email invitations, password-reset emails, MFA, social login, SSO, self-registration.
- User deletion, bulk operations, import/export, account history, profile photos.
- Formal SLA calculation, escalation, notification services, advanced dashboards.
- Multi-tenant organizations, departments, or multiple roles per user.
- Actions Taken by IT Staff (deferred to Lab 4).

## 4. Functional Requirements (FR)
- **FR-01**: The system shall allow users to authenticate using an email and password.
- **FR-02**: The system shall force users with a `requiresPasswordChange` flag to complete a password change before accessing any other application screen.
- **FR-03**: The system shall restrict Requesters to viewing and managing only their own Tickets and Attachments, using the authenticated session identity.
- **FR-04**: The system shall allow IT Staff to view a shared Ticket Queue, claim/reassign tickets, update IT Priority, and change ticket status per the transition matrix.
- **FR-05**: The system shall allow IT Staff and Administrators to create Internal Notes, which are hidden from Requesters.
- **FR-06**: The system shall allow Requesters to post Public Comments and indicate that a problem appears resolved.
- **FR-07**: The system shall allow Administrators to create, edit, activate/deactivate, and reset passwords for users, enforcing that a user has exactly one role.

## 5. Business Rules (BR)
- **BR-01**: Only an active user with valid credentials may authenticate.
- **BR-02**: A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
- **BR-03**: The authenticated user identity (from session/token), not a `requesterId` supplied by the client, determines ownership of Requester operations.
- **BR-04**: Public Comments are visible to Requester, IT Staff, and Administrator. Internal Notes are visible *only* to IT Staff and Administrator.
- **BR-05**: A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
- **BR-06**: Passwords must be hashed using bcrypt (or equivalent) and never stored in plaintext.
- **BR-07**: An Administrator cannot deactivate their own account.
- **BR-08**: The system must prevent the deactivation of the last active Administrator account.
- **BR-09**: Duplicate email addresses are strictly prohibited during user creation or update.
- **BR-10**: Ticket status transitions must follow the approved matrix (e.g., New → Open → In Progress → Waiting for Requester → Resolved → Closed). Reopened is allowed from Resolved/Closed. Cancelled is allowed from New/Open.
- **BR-11**: Empty or whitespace-only content in Public Comments or Internal Notes shall be rejected.

## 6. UI Specification Summary
See `docs/lab-03/ui-spec.md` for detailed wireframes and states. 
- **Zen Green Theme**: Reuse Lab 2 tokens, cards, badges, and form conventions.
- **Login/Change Password**: Clear validation, busy states, safe failure messages (no user enumeration).
- **IT Staff Queue**: Responsive table/card list with search, filters (status, priority), sorting, pagination, and ownership badges.
- **IT Staff Detail**: Grouped ticket info, editable operational fields, visually distinct Public Comments vs. Internal Notes sections.
- **Admin User Management**: Simple list with name/email search, optional role filter, create/edit modals, and clear validation feedback.

## 7. Data Changes (Prisma Schema Evolution)
- **User Model**: Add `password` (String, hashed), `role` (Enum: REQUESTER, IT_STAFF, ADMINISTRATOR), `isActive` (Boolean, default true), `requiresPasswordChange` (Boolean, default true).
- **Ticket Model**: Add `itPriority` (Enum, defaults to `requestedPriority`), `ownerId` (Optional relation to User), `status` (Enum updated to include New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled). Rename `requesterId` to `ownerId` or maintain `requesterId` as a relation to `User` where `role = REQUESTER`.
- **PublicComment Model**: New model with `ticketId`, `authorId`, `content`, `createdAt`.
- **InternalNote Model**: New model with `ticketId`, `authorId`, `content`, `createdAt`.
- **Migration Strategy**: Write a Prisma migration script that maps existing Lab 2 `DevelopmentRequester` (or `RequesterUser`) IDs to newly created `User` records (role: REQUESTER), preserving all existing Ticket and Attachment foreign keys.

## 8. API Contract Summary
See `docs/lab-03/api-spec.md` for exact endpoints. Key additions:
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- `GET /api/tickets/queue` (IT Staff/Admin only, with query params for search/filter/sort/page)
- `PATCH /api/tickets/:id/claim`, `PATCH /api/tickets/:id/priority`, `PATCH /api/tickets/:id/status`, `PATCH /api/tickets/:id/requester-resolved`
- `POST /api/tickets/:id/comments`, `POST /api/tickets/:id/notes`
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password`
*(Note: All Lab 2 endpoints are updated to derive `requesterId` from the authenticated session, removing it from query/body parameters).*

## 9. Acceptance Criteria (Sample)
- **AC-01**: Given an active user with valid credentials, when they log in, then the backend establishes an authenticated session and returns the user's identity and role.
- **AC-02**: Given a user with `requiresPasswordChange=true`, when they log in, then they are redirected to the Change Password screen and cannot access other routes until successful.
- **AC-03**: Given an authenticated Requester, when the client supplies another user's ID in a request, then the backend ignores it and applies the authenticated identity, returning only owned data.
- **AC-04**: Given a Requester account, when an Internal Note endpoint is requested, then the operation returns a 403 Forbidden without exposing note content or existence.
- **AC-05**: Given an Administrator, when they attempt to deactivate their own account, then the system rejects the request with a 400 Bad Request and a safe error message.

## 10. Definition of Done (Product)
- [ ] `specification.md`, `ui-spec.md`, `api-spec.md`, and `tests.md` are completed and approved.
- [ ] All GitHub Issues for Sprint 3 are in "Done", merged via PRs into `lab3-staging` then `main`.
- [ ] All planned unit, API, UI, and E2E tests pass locally and in CI.
- [ ] Migration script successfully preserves Lab 2 Ticket/Attachment data.
- [ ] Manual testing confirms all 9 submission parts (Auth, Queue, Detail, Admin UI, Zen Green responsiveness) work as specified.
- [ ] `ai-use.md` and `reviewer.md` are populated with required evidence.

## 11. Assumptions and Decisions
- **Session Management**: We will use HTTP-only cookies with JWT for session management to mitigate XSS and simplify CSRF handling with SameSite=Strict.
- **Password Reset**: Since email is excluded, Administrators will manually set a temporary password (e.g., "TempPass123!") and the `requiresPasswordChange` flag will be set to `true`.
- **Soft Delete**: User deactivation sets `isActive=false`. Hard deletion is not implemented per scope.