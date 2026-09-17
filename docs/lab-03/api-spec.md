# Lab 3 API Contract
All endpoints are prefixed `/api`. Authentication is handled via HTTP-only cookies containing a JWT. The authenticated user's identity and role are derived from the session, **not** from a `requesterId` in the request body or query.

## 1. Authentication & Session
### POST /api/auth/login
Authenticate a user.
**Request body:** `{ "email": "user@example.com", "password": "string" }`
**Response 200:** `{ "user": { "id": 1, "name": "John Doe", "email": "user@example.com", "role": "REQUESTER", "requiresPasswordChange": false } }`
**Errors:** `401` (Invalid credentials or inactive account), `400` (Validation error).

### POST /api/auth/logout
Invalidate the current session.
**Response 200:** `{ "message": "Logged out successfully" }`

### GET /api/auth/me
Retrieve current authenticated user.
**Response 200:** Same user object as login.
**Errors:** `401` (Unauthenticated).

### POST /api/auth/change-password
Change password (required if `requiresPasswordChange` is true).
**Request body:** `{ "currentPassword": "string", "newPassword": "string" }`
**Response 200:** `{ "message": "Password changed successfully", "requiresPasswordChange": false }`
**Errors:** `400` (Invalid new password format), `401` (Current password incorrect).

## 2. Requester Ticket & Attachment APIs (Updated from Lab 2)
*(Note: `requesterId` is no longer accepted. Ownership is enforced via `req.user.id`)*
- `GET /api/categories` → 200: Active categories.
- `GET /api/related-systems` → 200: Active related systems.
- `POST /api/tickets` → 201: Creates ticket owned by `req.user.id`.
- `GET /api/tickets` → 200: Paginated list filtered by `req.user.id` (plus query params: `search`, `category`, `requestedPriority`, `itPriority`, `status`, `sortBy`, `sortDir`, `page`, `pageSize`).
- `GET /api/tickets/:id` → 200: Ticket detail + attachments. `403/404` if not owned by `req.user.id`.
- `POST /api/tickets/:id/attachments` → 201: Upload attachment. `403` if not owner.
- `DELETE /api/attachments/:id` → 200: Soft-remove. `403` if not owner.

### PATCH /api/tickets/:id/requester-resolved
Allow Requester to indicate problem appears resolved.
**Response 200:** Updated ticket with status `WAITING_FOR_REQUESTER` or a custom flag.
**Errors:** `403` (Not owner), `404` (Not found).

## 3. IT Staff Ticket Operations
### GET /api/tickets/queue
Retrieve paginated, searchable, filterable ticket list for IT Staff/Admin.
**Query params:** `search`, `status`, `itPriority`, `ownerId`, `sortBy`, `sortDir`, `page`, `pageSize`.
**Response 200:** `{ "data": [...], "pagination": { "page": 1, "pageSize": 10, "totalItems": 50, "totalPages": 5 } }`
**Errors:** `403` (Not IT Staff or Admin).

### PATCH /api/tickets/:id/claim
Claim ticket ownership. Sets `ownerId` to `req.user.id`.
**Response 200:** Updated ticket.
**Errors:** `403` (Not IT Staff/Admin), `409` (Already claimed by another IT Staff, if business rule dictates).

### PATCH /api/tickets/:id/priority
Update IT Priority.
**Request body:** `{ "itPriority": "HIGH" }`
**Response 200:** Updated ticket.
**Errors:** `400` (Invalid priority), `403` (Not IT Staff/Admin).

### PATCH /api/tickets/:id/status
Update ticket status.
**Request body:** `{ "status": "IN_PROGRESS" }`
**Response 200:** Updated ticket.
**Errors:** `400` (Invalid transition per matrix), `403` (Not IT Staff/Admin).

### POST /api/tickets/:id/comments
Create a Public Comment.
**Request body:** `{ "content": "string" }`
**Response 201:** `{ "id": 1, "ticketId": 101, "authorId": 1, "content": "string", "createdAt": "..." }`
**Errors:** `400` (Empty content), `403` (Unauthenticated).

### POST /api/tickets/:id/notes
Create an Internal Note.
**Request body:** `{ "content": "string" }`
**Response 201:** Note object.
**Errors:** `400` (Empty content), `403` (Not IT Staff or Admin).

## 4. Administrator User Management
### GET /api/users
Retrieve user list.
**Query params:** `search` (name/email), `role` (optional filter). *(No pagination required per handout, but safe limits apply)*.
**Response 200:** `[{ "id": 1, "name": "Admin", "email": "admin@test.com", "role": "ADMINISTRATOR", "isActive": true }]`
**Errors:** `403` (Not Administrator).

### POST /api/users
Create a new user.
**Request body:** `{ "name": "string", "email": "string", "role": "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", "isActive": true, "initialPassword": "string" }`
**Response 201:** Created user object (excluding password hash).
**Errors:** `400` (Invalid role, weak password), `409` (Duplicate email), `403` (Not Administrator).

### PATCH /api/users/:id
Update user basic info.
**Request body:** `{ "name": "string", "email": "string", "role": "string", "isActive": boolean }`
**Response 200:** Updated user object.
**Errors:** `400` (Attempting to deactivate self or last active admin), `409` (Duplicate email), `403` (Not Administrator).

### POST /api/users/:id/reset-password
Set a new initial password for a user.
**Request body:** `{ "newPassword": "string" }`
**Response 200:** `{ "message": "Password reset successfully", "requiresPasswordChange": true }`
**Errors:** `400` (Weak password), `403` (Not Administrator).