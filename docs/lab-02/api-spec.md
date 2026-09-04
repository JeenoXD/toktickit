# Lab 2 API Contract

All endpoints are prefixed `/api`. All ticket/attachment endpoints require a `requesterId` (query
param for GET, body field for POST/DELETE) representing the active Development Requester — this is a
Lab 2 testing mechanism, not real authorization, but ownership checks are still enforced server-side.

## 1. GET /api/categories

Retrieve active Categories.

**Response 200**
```json
[{ "id": 1, "name": "Hardware" }]
```

## 2. GET /api/related-systems

Retrieve active Related Systems.

**Response 200**
```json
[{ "id": 1, "name": "Corporate Laptop" }]
```

## 3. GET /api/requesters

Retrieve active Development Requesters.

**Response 200**
```json
[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer@example.com" }]
```

Inactive Requesters are never included.

## 4. POST /api/tickets

Create one validated Ticket for the selected Development Requester. Multipart form data (to support
attachments in the same request) or JSON + a separate attachment upload call — student decides and
documents the final choice here once implemented.

**Request body**
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains much faster than usual, started after last update.",
  "requestedPriority": "MEDIUM"
}
```

**Response 201**
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000101",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains much faster than usual, started after last update.",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "createdAt": "2026-09-04T10:00:00.000Z",
  "updatedAt": "2026-09-04T10:00:00.000Z"
}
```

**Validation failures — 400**
```json
{ "error": "VALIDATION_ERROR", "fields": { "summary": "Summary is required (5-150 characters)." } }
```

**Other errors:**
- `404` — `categoryId` or `relatedSystemId` does not exist / is inactive
- `500` — unexpected server error (ticket not saved; safe generic message returned)

## 5. GET /api/tickets

Paginated, filtered, sorted, ownership-scoped ticket list.

**Query parameters**

| Param | Type | Notes |
|---|---|---|
| `requesterId` | number, required | Scopes results to this Requester only |
| `search` | string, optional | Matches Ticket Number or Summary (case-insensitive, partial) |
| `category` | number, optional | Filter by categoryId |
| `requestedPriority` | string, optional | `LOW`/`MEDIUM`/`HIGH` |
| `itPriority` | string, optional | `LOW`/`MEDIUM`/`HIGH` |
| `status` | string, optional | e.g. `NEW` |
| `sortBy` | string, optional | `createdAt` \| `updatedAt` (default `createdAt`) |
| `sortDir` | string, optional | `asc` \| `desc` (default `desc`) |
| `page` | number, optional | default `1`; invalid values fall back to `1` |
| `pageSize` | number, optional | default `10`, max `50`; invalid values fall back to default |

**Response 200**
```json
{
  "data": [ { "id": 101, "ticketNumber": "TKT-2026-000101", "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
}
```

An empty `data` array with `totalItems: 0` covers both the empty-list and no-results cases; the
frontend distinguishes them by whether any search/filter params were present in the request.

## 6. GET /api/tickets/:id

Retrieve one ticket owned by the requesting Requester.

**Query parameters:** `requesterId` (required)

**Response 200:** full ticket object (same shape as POST response) plus its attachments array.

**Errors:**
- `403` or `404` — ticket exists but is not owned by `requesterId` (do not leak existence)
- `404` — ticket does not exist at all

## 7. POST /api/tickets/:id/attachments

Upload one attachment to an owned ticket. Multipart form data.

**Request:** `requesterId` (form field), `file` (binary)

**Response 201**
```json
{ "id": 55, "ticketId": 101, "filename": "screenshot.png", "sizeBytes": 204800, "uploadedAt": "2026-09-04T10:05:00.000Z" }
```

**Errors:**
- `400` — unsupported file type
- `413` — file exceeds 5 MB
- `409` — ticket already has 5 active attachments
- `403`/`404` — ticket not owned by `requesterId`

## 8. GET /api/tickets/:id/attachments

Retrieve attachment metadata for a ticket (active and removed).

**Query parameters:** `requesterId` (required)

**Response 200**
```json
[
  { "id": 55, "filename": "screenshot.png", "sizeBytes": 204800, "uploadedAt": "2026-09-04T10:05:00.000Z", "removedAt": null, "removedReason": null }
]
```

## 9. GET /api/attachments/:id/download

Download an active attachment's file content.

**Query parameters:** `requesterId` (required)

**Response 200:** binary file stream with appropriate `Content-Type`/`Content-Disposition`.

**Errors:**
- `403`/`404` — not owned by `requesterId`
- `410` — attachment has been soft-removed (gone, not downloadable)

## 10. DELETE /api/attachments/:id

Soft-remove an attachment.

**Request body**
```json
{ "requesterId": 1, "reason": "Uploaded wrong file" }
```

**Response 200**
```json
{ "id": 55, "removedAt": "2026-09-04T10:10:00.000Z", "removedReason": "Uploaded wrong file" }
```

**Errors:**
- `400` — missing reason
- `403`/`404` — not owned by `requesterId`
- `409` — attachment already removed

## 11. HTTP Status Summary

| Status | Meaning in this API |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Resource created (ticket, attachment) |
| 400 | Invalid input / validation failure / missing required field |
| 403/404 | Ownership failure or resource not found (used interchangeably to avoid leaking existence) |
| 409 | Conflict (duplicate removal, attachment limit reached) |
| 410 | Resource permanently unavailable (removed attachment download attempt) |
| 413 | Payload too large (oversized attachment) |
| 500 | Unexpected server error (generic safe message, no stack trace leaked) |
