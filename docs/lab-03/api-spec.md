# Lab 3 API Contract
All endpoints are prefixed `/api`. Authentication is handled via HTTP-only cookies containing a JWT. The authenticated user's identity and role are derived from the session, **not** from a `requesterId` in the request body or query.

## 1. Authentication & Session
### POST /api/auth/login
Authenticate a user.
**Request body:** `{ "email": "user@example.com", "password": "string" }`
**Response 200:** `{ "user": { "id": 1, "name": "John Doe", "email": "user@example.com", "role": "REQUESTER", "requiresPasswordChange": false } }`
**Errors:** `401` (Invalid credentials or inactive account — same generic message either way), `400` (Missing email or password).

### POST /api/auth/logout
Invalidate the current session by clearing the auth cookie.
**Response 200:** `{ "message": "Logged out successfully" }`

### GET /api/auth/me
Retrieve the current authenticated user, read fresh from the database (not from stale JWT claims).
**Response 200:** Same user object shape as login.
**Errors:** `401` (No cookie, or malformed/tampered token).

### POST /api/auth/change-password
Change password (required if `requiresPasswordChange` is true, but callable any time).
**Request body:** `{ "currentPassword": "string", "newPassword": "string" }`
**Response 200:** `{ "message": "Password changed successfully", "requiresPasswordChange": false }`
**Errors:** `400` (New password fails strength rules), `401` (Current password incorrect, or unauthenticated).

## 2. Requester Ticket & Attachment APIs (Updated from Lab 2)
*(Note: `requesterId` is no longer accepted. Ownership is enforced via `req.user.id`)*
- `GET /api/categories` → 200: Active categories.
- `GET /api/related-systems` → 200: Active related systems.
- `POST /api/tickets` → 201: Creates ticket owned by `req.user.id`. `itPriority` is automatically set to a copy of the submitted `requestedPriority` (BR-12).
- `GET /api/tickets` → 200: Paginated list filtered by `req.user.id` (plus query params: `search`, `category`, `requestedPriority`, `page`).
- `GET /api/tickets/:id` → 200: Ticket detail (including `publicComments`) + attachments. `404` if not owned by `req.user.id` (never reveals whether the ticket exists for another requester).
- `POST /api/tickets/:id/attachments` → 201: Upload attachment. `403`/`404` if not owner.
- `DELETE /api/attachments/:id` → 200: Soft-remove with a reason. `403`/`404` if not owner.
- `POST /api/tickets/:id/comments`, `GET /api/tickets/:id/comments` → Public Comments; see Section 3.

### PATCH /api/tickets/:id/requester-resolved
Allow a Requester to indicate the problem appears resolved (BR-05). Only permitted while the ticket is not already in a terminal state; moves the ticket to `IN_PROGRESS` so IT Staff can confirm and formally resolve it, it does **not** set `WAITING_FOR_REQUESTER` (that status means the opposite: the ticket is waiting on the Requester) and does **not** go through `PATCH /api/tickets/:id/status`'s general transition matrix, this endpoint has its own narrower eligibility rule.
**Response 200:** Updated ticket with `currentStatus: "IN_PROGRESS"`.
**Errors:** `403` (Not the ticket's Requester, or not a Requester at all), `404` (Ticket not found), `400` (Ticket is already `RESOLVED`, `CLOSED`, or `CANCELLED`).

## 3. IT Staff Ticket Operations
### GET /api/tickets/queue
Retrieve paginated, searchable, filterable, sortable ticket list for IT Staff/Admin.
**Query params:** `search` (ticket number or summary, case-insensitive substring), `status`, `itPriority`, `ownerId`, `sortBy` (`createdAt` | `updatedAt` | `itPriority`), `sortDir` (`asc` | `desc`), `page`, `pageSize` (max 50, default 10). Invalid `sortBy` returns `400`; invalid `page`/`pageSize` fall back to defaults rather than erroring.
**Response 200:** `{ "data": [...], "pagination": { "page": 1, "pageSize": 10, "totalItems": 50, "totalPages": 5 } }`
**Errors:** `403` (Not IT Staff or Admin).

### PATCH /api/tickets/:id/claim
Claim ticket ownership. Sets `ownerId` to `req.user.id`, unconditionally, regardless of whether the ticket was already owned by someone else — claiming is "assign to me," reassigning to a *different* IT Staff member uses the separate endpoint below.
**Response 200:** Updated ticket.
**Errors:** `403` (Not IT Staff/Admin), `404` (Ticket not found).

### PATCH /api/tickets/:id/reassign
Reassign ticket ownership to a specified IT Staff or Administrator user.
**Request body:** `{ "ownerId": 6 }`
**Response 200:** Updated ticket.
**Errors:** `400` (`ownerId` missing/not a positive integer, or the target user isn't an IT Staff/Admin), `403` (Not IT Staff/Admin), `404` (Ticket not found).

### PATCH /api/tickets/:id/priority
Update IT Priority.
**Request body:** `{ "itPriority": "HIGH" }`
**Response 200:** Updated ticket.
**Errors:** `400` (Invalid priority value), `403` (Not IT Staff/Admin).

### PATCH /api/tickets/:id/status
Update ticket status, validated against the approved transition matrix (New→Open→In Progress→{Waiting for Requester, Resolved}→Closed, plus Reopened and Cancelled per BR-10).
**Request body:** `{ "status": "IN_PROGRESS" }`
**Response 200:** Updated ticket.
**Errors:** `400` (Invalid status value, or a transition the matrix doesn't permit from the ticket's current status), `403` (Not IT Staff/Admin).

### POST /api/tickets/:id/comments
Create a Public Comment. Available to the ticket's Requester as well as IT Staff/Admin.
**Request body:** `{ "content": "string" }`
**Response 201:** `{ "id": 1, "ticketId": 101, "authorId": 1, "content": "string", "createdAt": "..." }`
**Errors:** `400` (Empty/whitespace-only content), `401` (Unauthenticated), `404` (Ticket not found or not accessible).

### GET /api/tickets/:id/comments
Retrieve Public Comments for a ticket. Available to the ticket's Requester as well as IT Staff/Admin.
**Response 200:** Array of comment objects.
**Errors:** `401` (Unauthenticated), `404` (Ticket not found or not accessible).

### POST /api/tickets/:id/notes
Create an Internal Note. IT Staff/Admin only (BR-04).
**Request body:** `{ "content": "string" }`
**Response 201:** Note object.
**Errors:** `400` (Empty content), `403` (Not IT Staff or Admin).

### GET /api/tickets/:id/notes
Retrieve Internal Notes for a ticket. IT Staff/Admin only.
**Response 200:** Array of note objects.
**Errors:** `403` (Not IT Staff or Admin).

## 4. Administrator User Management
### GET /api/users
Retrieve user list.
**Query params:** `search` (name/email, case-insensitive substring), `role` (optional filter). *(No pagination required per handout.)*
**Response 200:** `[{ "id": 1, "name": "Admin", "email": "admin@example.com", "role": "ADMINISTRATOR", "isActive": true }]`
**Errors:** `403` (Not Administrator).

### POST /api/users
Create a new user with a required initial password (always sets `requiresPasswordChange: true`).
**Request body:** `{ "name": "string", "email": "string", "role": "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", "isActive": true, "initialPassword": "string" }`
**Response 201:** Created user object (excluding password hash).
**Errors:** `400` (Missing name/email, invalid role, weak password), `409` (Duplicate email), `403` (Not Administrator).

### PATCH /api/users/:id
Update user basic info.
**Request body:** `{ "name": "string", "email": "string", "role": "string", "isActive": boolean }`
**Response 200:** Updated user object.
**Errors:** `400` (Attempting to deactivate self or the last active admin), `409` (Duplicate email), `403` (Not Administrator).

### POST /api/users/:id/reset-password
Set a new initial password for a user; always sets `requiresPasswordChange: true`.
**Request body:** `{ "newPassword": "string" }`
**Response 200:** `{ "message": "Password reset successfully", "requiresPasswordChange": true }`
**Errors:** `400` (Weak password), `403` (Not Administrator).