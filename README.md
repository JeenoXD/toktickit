# TokTickIT

IT service desk application for CPE334, Labs 1 to 4.

TokTickIT lets Requesters report IT problems and lets IT Staff plan, record, and resolve the work. Lab 4 completes the product: IT Staff record **Actions Taken** on each Ticket, the backend enforces the final **status workflow and resolution gate**, every role starts on a **dashboard**, and the whole application was hardened for the final demonstration.

## Features

**Lab 4 (final sprint)**

- Actions Taken on every Ticket: date/time, description, result, performed by (defaults to you, can be another active IT Staff member), follow-up required with a follow-up note, and attachment notes. Actions are Planned, then Completed or Cancelled. Requesters see them read only.
- Final status matrix enforced by the backend. In Progress needs an owner; Resolved needs an owner, at least one completed action, and no planned actions; only an Administrator can reopen a cancelled Ticket.
- Append-only status history shown on both Ticket Detail screens.
- Stale-update protection: workflow changes and action edits send a `version`; if someone else changed the record first, you get a "changed by someone else" message with Reload instead of overwriting their work.
- Requester "Problem Appears Resolved" is advisory: it flags the Ticket for IT Staff and does not change the status.
- Dashboards: Requester (own tickets only), IT Staff, and Administrator (adds user counts and the system check). Every card drills down to the matching filtered list.
- IT Staff can open a ticket's attachments (read only), so files named in Attachment Notes are reachable.
- Hardening: removed an unauthenticated `?requesterId=` shortcut left from Lab 2, protected the requester list, authenticated uploads before storing files, double-submit protection on forms, readable status and role labels everywhere, database-aware health check, client build fixed, and a full regression run.

**Labs 1 to 3 (still working)**

- Health check and categories (Lab 1)
- Requester ticket creation, My Tickets, Ticket Detail, attachments (Lab 2)
- Login, mandatory password change, roles, Public Comments, Internal Notes, IT Staff queue and ticket operations, Administrator user management (Lab 3)

## Project Setup

You need Node.js 20 or later and Docker (for PostgreSQL).

### 1. Database

First time only, create the PostgreSQL container:

    docker run --name toktickit-postgres -e POSTGRES_USER=toktickit -e POSTGRES_PASSWORD=toktickit -e POSTGRES_DB=toktickit -p 5432:5432 -d postgres:16

After that, start it with:

    docker start toktickit-postgres

### 2. Backend

    cd server
    npm install

Copy `server/.env.example` to `server/.env` and set your own `JWT_SECRET`.

Apply all migrations and seed the database:

    npx prisma migrate dev
    npm run prisma:seed

Start the API on http://localhost:3000:

    npm run dev

### 3. Frontend

In a second terminal:

    cd client
    npm install
    npm run dev

Open the URL Vite prints (http://localhost:5173).

## Database Migrations

| Migration | Lab | What it does |
| --- | --- | --- |
| `20260814080141_init` | 1 | Categories |
| `20260904102238_add_requester_user` | 2 | Development requesters |
| `20260905050335_add_ticket_attachment_relatedsystem` | 2 | Tickets, attachments, related systems |
| `20260917120000_migrate_to_lab3_users` | 3 | Real users, roles, comments, notes |
| `20261020120000_lab4_actions_taken` | 4 | Actions Taken, status history, ticket version; backfills one history row per existing ticket |
| `20261020134608_fix_lab3_unique_constraints` | 4 | Repairs names, indexes, and foreign keys the hand-written Lab 2/3 migrations left out of step with `schema.prisma` |

The Lab 4 migration is additive: no existing column or table is dropped or renamed, so Lab 1 to 3 data is kept.

**Rollback.** Take a backup first, then run the rollback script:

    pg_dump -U toktickit toktickit > lab3_backup.sql
    psql -U toktickit toktickit -f server/prisma/rollback/lab4_rollback.sql

## Seed Data

`npm run prisma:seed` resets the database to a known state and is safe to run any number of times. It creates tickets in all 8 statuses, all IT priorities (including not set), assigned and unassigned tickets, tickets with 0, 1, and 3 Actions Taken, an action performed by someone other than the owner, a ticket flagged "appears resolved", an attachment the VPN ticket's Attachment Notes refer to, and a Requester with no tickets for empty dashboards.

### Seeded Accounts (local development only)

All seeded accounts start with the password `TempPass123!` and must change it on first login. Never reuse these for anything real.

| Role | Email | Active |
| --- | --- | --- |
| Requester | jennifer.anderson@example.com | Yes |
| Requester | michael.brown@example.com | Yes |
| Requester | sarah.johnson@example.com | Yes |
| Requester | david.lee@example.com | Yes |
| Requester | emily.carter@example.com (no tickets, for empty dashboards) | Yes |
| Requester | inactive.user@example.com | No |
| IT Staff | it.staff@example.com | Yes |
| IT Staff | it.staff2@example.com (Carlos Mendez) | Yes |
| IT Staff | it.staff3@example.com (Aisha Rahman) | Yes |
| IT Staff | it.staff.inactive@example.com | No |
| Administrator | admin@example.com | Yes |

## Demonstration Walkthrough

1. **Requester dashboard.** Sign in as `jennifer.anderson@example.com`. You land on the dashboard; click a card such as "My Open Tickets" to open the filtered My Tickets list.
2. **Appears resolved.** Open "Laptop battery drains quickly" and click "Problem Appears Resolved". The status stays the same; the ticket is flagged for IT Staff.
3. **Staff dashboard.** Sign in as `it.staff@example.com`. Check Unassigned, My Assigned, Appears Resolved, and My Planned Actions; click a card to open the filtered queue.
4. **Actions Taken.** Open "Cannot connect to VPN" (3 actions, two performers). Add an action, edit a planned one, complete it with a result, and cancel another.
5. **Resolution gate.** On a ticket without a completed action, the Status list shows "Resolved (blocked)" with the reason. Claim it, move it to In Progress, record a completed action, then resolve and close it. Watch the Status History grow.
6. **Stale update.** Open the same ticket as `it.staff@example.com` and as `admin@example.com` in two browsers. Change the status in one, then try in the other: you get "changed by someone else" and a Reload button.
7. **Administrator.** Sign in as `admin@example.com` to see user counts and the System status check on the dashboard, and User Management.

## Running Tests

Backend (unit, API, migration, security, dashboards):

    cd server
    npm test

Frontend (UI components):

    cd client
    npm test

End to end (Playwright, desktop, tablet, and mobile; reseeds the database before each viewport). Start the backend and frontend first, then:

    cd e2e
    npm install
    npx playwright test

Production builds:

    cd server && npm run build
    cd client && npm run build

## Documentation

    docs/
    ├── lab-01/
    ├── lab-02/
    ├── lab-03/
    └── lab-04/
        ├── specification.md   requirements, business rules, transition matrix, dashboard calculations, data changes
        ├── api-spec.md        endpoints, errors, concurrency, dashboard contract
        ├── ui-spec.md         screens, states, responsive and accessibility checklist
        ├── tests.md           planned tests, acceptance-criterion traceability, final results
        ├── reviewer.md        peer review record
        └── ai-use.md          AI use and reflection

Screenshots for the final screens are in `artifacts/lab-04/screenshots/`.
