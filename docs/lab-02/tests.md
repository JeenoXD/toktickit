# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from `specification.md` before implementation, per Issue, following TDD: write the
failing test tied to an Issue's Acceptance Criteria first, implement the minimum code to pass it, then
refactor. Levels covered: unit, API/integration, UI component, UI style/responsive, and E2E. Every AC
maps to at least one automated test.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01 | Ticket Number generator format | Returns `TKT-YYYY-NNNNNN`, unique per call | `server/tests/lab-02/ticketNumber.unit.test.ts` | TODO |
| API-01 | API | AC-01, FR-03, FR-04 | Create valid ticket | 201; ticket saved; unique ticketNumber returned | `server/tests/lab-02/create-ticket.api.test.ts` | TODO |
| API-02 | API | AC-04, BR-08 | Create ticket with empty Summary | 400; field-level error in response | `server/tests/lab-02/create-ticket.api.test.ts` | TODO |
| API-03 | API | AC-05, BR-15 | Create ticket with oversized attachment | 201 for ticket; 400/rejected for the oversized file | `server/tests/lab-02/attachments.api.test.ts` | TODO |
| API-04 | API | AC-03, FR-10, BR-20 | Fetch ticket owned by a different Requester | 403/404; ticket data not returned | `server/tests/lab-02/ticket-detail.api.test.ts` | TODO |
| API-05 | API | FR-05, AC-07 | Paginated ticket list | Returns correct page slice + pagination metadata | `server/tests/lab-02/my-tickets.api.test.ts` | TODO |
| API-06 | API | FR-06 | Search tickets by Summary/Ticket Number | Returns only matching tickets | `server/tests/lab-02/my-tickets.api.test.ts` | TODO |
| API-07 | API | FR-07 | Filter tickets by Category/Priority/Status | Returns only matching tickets | `server/tests/lab-02/my-tickets.api.test.ts` | TODO |
| API-08 | API | FR-08 | Sort tickets by Created/Updated date | Returns correctly ordered results | `server/tests/lab-02/my-tickets.api.test.ts` | TODO |
| API-09 | API | AC-08 | Search with no matches | Returns empty array + no-results metadata | `server/tests/lab-02/my-tickets.api.test.ts` | TODO |
| API-10 | API | AC-09, BR-16 | Soft-remove attachment | Metadata retained; `removedAt` set; not downloadable | `server/tests/lab-02/attachments.api.test.ts` | TODO |
| API-11 | API | AC-10 | Download a removed attachment | Request rejected regardless of frontend state | `server/tests/lab-02/attachments.api.test.ts` | TODO |
| API-12 | API | BR-17, FR-11 | Add attachment as non-owner | Rejected (403/404) | `server/tests/lab-02/attachments.api.test.ts` | TODO |
| API-13 | API | AC-11, BR-05 | Fetch active Requesters | Inactive Requester excluded from response | `server/tests/lab-02/requesters.api.test.ts` | TODO |
| API-14 | API | Section 6 (retrieve active Related Systems) | Fetch active Related Systems | Returns only active Related Systems, seeded ≥6 | `server/tests/lab-02/related-systems.api.test.ts` | TODO |
| UI-01 | UI | AC-02 | Access app with no Requester selected | AppShell renders Requester Selection screen instead of ticket screens | `client/tests/lab-02/App.test.tsx` | TODO |
| UI-02 | UI | AC-04 | Submit Create Ticket with empty Summary | Field message shown; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | TODO |
| UI-03 | UI | BR-12 | Double-click Submit | Second submission blocked; button shows busy state | `client/tests/lab-02/CreateTicket.test.tsx` | TODO |
| UI-04 | UI | AC-06, BR-13 | Submit with backend unreachable | Safe error shown; form values preserved | `client/tests/lab-02/CreateTicket.test.tsx` | TODO |
| UI-05 | UI | AC-08 | My Tickets search with no matches | No-results state shown, distinct from empty-list state | `client/tests/lab-02/MyTickets.test.tsx` | TODO |
| UI-06 | UI | FR-05 | My Tickets with zero tickets | Empty-list state shown | `client/tests/lab-02/MyTickets.test.tsx` | TODO |
| UI-07 | UI | AC-12 | Change Requester | Clicking Change Requester in AppShell clears context and reloads Requester-scoped data | `client/tests/lab-02/App.test.tsx` | TODO |
| UI-08 | UI | AC-09 | Remove attachment with reason | Confirmation flow; attachment shown as removed | `client/tests/lab-02/AttachmentSection.test.tsx` | TODO |
| UI-09 | UI | AC-05 | Select invalid attachment type/size | Client-side rejection message shown before upload | `client/tests/lab-02/AttachmentSection.test.tsx` | TODO |
| UI-10 | UI | FR-09 | Requester Ticket Detail renders read-only fields | All ticket header fields shown, styled read-only, no edit controls | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | TODO |
| UI-11 | UI | Section 8.1 required elements | Requester Selection screen states | Loading, empty (no active Requesters), and API-failure states each render correctly | `client/tests/lab-02/RequesterSelection.test.tsx` | TODO |
| RESP-01 | Responsive | Section 8.7 | Create Ticket at desktop/tablet/mobile | No clipping/overlap/horizontal scroll at any breakpoint | Playwright screenshots, `artifacts/lab-02/screenshots/create-ticket/` | TODO |
| RESP-02 | Responsive | Section 8.7 | My Tickets at desktop/tablet/mobile | Table/card layout switches correctly, no overflow | Playwright screenshots, `artifacts/lab-02/screenshots/my-tickets/` | TODO |
| RESP-03 | Responsive | Section 8.7 | Ticket Detail at desktop/tablet/mobile | Field grouping and attachment section remain usable | Playwright screenshots, `artifacts/lab-02/screenshots/ticket-detail/` | TODO |
| E2E-01 | E2E | AC-01, FR-03, FR-04 | Full ticket creation flow | Confirmation shows official Ticket Number | `e2e/lab-02/create-ticket.spec.ts` | TODO |
| E2E-02 | E2E | AC-01, FR-05 | Create then find ticket in My Tickets | New ticket appears in the list | `e2e/lab-02/create-ticket.spec.ts` | TODO |
| E2E-03 | E2E | AC-03, FR-10 | Cross-Requester access attempt | Requester B cannot view Requester A's ticket | `e2e/lab-02/requester-ticket-flow.spec.ts` | TODO |
| E2E-04 | E2E | AC-09, FR-12 | Add and soft-remove an attachment end-to-end | Attachment shown, then shown as removed with reason | `e2e/lab-02/requester-ticket-flow.spec.ts` | TODO |

## 3. Acceptance-Criterion Traceability

| AC | Covered By |
|---|---|
| AC-01 | API-01, E2E-01, E2E-02 |
| AC-02 | UI-01 |
| AC-03 | API-04, E2E-03 |
| AC-04 | API-02, UI-02 |
| AC-05 | API-03, UI-09 |
| AC-06 | UI-04 |
| AC-07 | API-05 |
| AC-08 | API-09, UI-05 |
| AC-09 | API-10, UI-08, E2E-04 |
| AC-10 | API-11 |
| AC-11 | API-13 |
| AC-12 | UI-07 |

## 4. Responsive and Visual Checklist

- [ ] No clipped labels at any breakpoint
- [ ] No overlapping validation messages
- [ ] No unintended horizontal scrolling
- [ ] Editable vs read-only fields are visually distinct per `ui-spec.md`
- [ ] Priority/Status badges are consistent across Create Ticket, My Tickets, Ticket Detail
- [ ] Filters, pagination, and attachment controls remain usable at mobile width
- [ ] Screenshots match `ui-spec.md` and approved illustrations, not personal memory

## 5. Test Commands

```bash
# Backend
cd server
npm test

# Frontend
cd client
npm test

# E2E (Playwright)
cd e2e
npx playwright test
```

## 6. Final Results

*(Fill in once implementation is complete — paste terminal output or screenshots showing all tests passing on the final `main` branch.)*

## 7. Known Limitations or Deferred Tests

*(Note anything intentionally not covered in Lab 2 — e.g. load testing, concurrent-submission race conditions beyond basic double-submit prevention.)*
