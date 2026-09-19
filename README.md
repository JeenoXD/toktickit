# TokTickIT

IT service desk application — CPE334 Labs 1-3

TokTickIT is an IT service desk application. Lab 3 replaces Lab 2's temporary Development Requester selector with real authentication and role-based authorization, and adds an operational IT Staff ticket workflow and a minimalist Administrator user management screen.

## Lab 3 Features

- Email/password authentication with mandatory first-login password change
- Role-based navigation and server-side authorization for Requester, IT Staff, and Administrator
- Requester: create and manage own Tickets, post Public Comments, mark a problem as "appears resolved"
- IT Staff: shared Ticket Queue (search, filter, sort, pagination), claim/reassign ownership, set IT Priority, update ticket status through a validated transition matrix, post Public Comments, write Internal Notes
- Administrator: minimalist User Management (list, search, role filter, create/edit users, activate/deactivate, reset password)
- Full Lab 2 Requester ticketing carried forward under the authenticated identity (no more Development Requester selector)
- Responsive Zen Green UI on desktop, tablet, and mobile
- Automated unit, API, UI component, and end-to-end (Playwright) test coverage

## Project Setup

### 1. Backend

Open a terminal and navigate to the `server` folder:

    cd server

Install dependencies:

    npm install

### Start PostgreSQL

If the PostgreSQL container already exists:

    docker start toktickit-postgres

Check that it is running:

    docker ps

### Set Up the Database

Run the Prisma migration:

    npm run prisma:migrate

Seed the database:

    npm run prisma:seed

This creates the ticket Categories and Related Systems, plus the seeded Users described below.

Start the backend:

    npm run dev

### 2. Frontend

Open a second terminal and navigate to the `client` folder:

    cd client

Install dependencies:

    npm install

Start the Vite development server:

    npm run dev

Open the frontend URL shown by Vite.

## Using the Application

1. Open the TokTickIT frontend — you'll land on the Sign In screen.
2. Sign in with one of the seeded accounts below.
3. Every seeded account requires a password change on first login — you'll be taken to the Change Password screen automatically and cannot access the rest of the app until it's completed.
4. Once past that, the navigation and actions available depend on your account's role (Requester, IT Staff, or Administrator).

### Seeded Accounts (local development only)

All seeded accounts share the initial password `TempPass123!` and must change it on first login. These are for local development and testing only — never use these credentials, or this pattern, for any real account.

| Role | Email | Active |
| --- | --- | --- |
| Requester | jennifer.anderson@example.com | Yes |
| Requester | michael.brown@example.com | Yes |
| Requester | sarah.johnson@example.com | Yes |
| Requester | david.lee@example.com | Yes |
| Requester | inactive.user@example.com | No |
| IT Staff | it.staff@example.com | Yes |
| IT Staff | it.staff2@example.com | Yes |
| IT Staff | it.staff3@example.com | Yes |
| IT Staff | it.staff.inactive@example.com | No |
| Administrator | admin@example.com | Yes |

The seed also creates a realistic spread of tickets across these Requesters (varied statuses, priorities, and IT Staff ownership), plus example Public Comments and Internal Notes.

## API

The backend provides REST API endpoints for:

- Authentication: login, logout, current user, mandatory password change
- Requester ticket/attachment operations (Lab 2 functionality, now scoped to the authenticated session)
- IT Staff Ticket Queue retrieval with search, filters, sorting, and pagination
- IT Staff ticket operations: claim, reassign, set IT Priority, update status, Public Comments, Internal Notes
- Administrator user management: list, create, edit, and reset passwords for users

The full API contract is documented in:

    docs/lab-03/api-spec.md

## Documentation

Documentation for each lab is located under `docs/`:

    docs/
    ├── lab-01/
    ├── lab-02/
    └── lab-03/
        ├── specification.md
        ├── tests.md
        ├── ui-spec.md
        ├── api-spec.md
        ├── reviewer.md
        └── ai-use.md

## Running Tests

### Backend Tests

    cd server
    npm test

### Frontend Tests

    cd client
    npm test

### End-to-End Tests (Playwright)

    cd e2e
    npx playwright test

This runs the full Lab 2 and Lab 3 Playwright suite across desktop, tablet, and mobile viewports, reseeding the database before each viewport so every run starts from a known-clean state.
