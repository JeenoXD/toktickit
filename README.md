# TokTickIT

IT service desk application — CPE334 Lab 2

TokTickIT is a Requester-facing IT service desk application. Lab 2 extends the Lab 1 foundation with a temporary Development Requester context and Requester ticketing workflows.

## Lab 2 Features

- Development Requester Selection for testing
- Active Requester loading from PostgreSQL
- Change Requester functionality
- Create IT support tickets
- Backend-generated Ticket Numbers
- Ticket category and related system selection
- Requested priority
- Ticket validation and error handling
- Supporting attachment upload
- My Tickets view
- Search, filtering, sorting, and pagination
- Requester Ticket Detail view
- Attachment inspection, download, and soft removal
- Requester ownership protection
- Loading, empty, no-results, success, and failure states
- Responsive Zen Green UI

> The Development Requester Selection is a testing mechanism for Lab 2 and is not real authentication. Authentication and role-based authorization are planned for Lab 3.

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

The seed creates the required ticket categories and Development Requesters.

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

1. Open the TokTickIT frontend.
2. Click **Select Development Requester**.
3. Select an active Development Requester.
4. Click **Continue**.
5. The selected Requester becomes the current testing context.
6. Create and manage tickets for the selected Requester.
7. Use **Change Requester** to switch to another Development Requester.

Only active Development Requesters are available for selection.

## API

The backend provides REST API endpoints for:

- Active Categories
- Active Related Systems
- Active Development Requesters
- Ticket creation
- Requester-owned ticket lists
- Ticket Detail
- Attachment upload
- Attachment metadata
- Attachment download
- Attachment soft removal

The Lab 2 API contract is documented in:

    docs/lab-02/api-spec.md

## Documentation

Lab 2 documentation is located in:

    docs/lab-02/
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

### End-to-End Tests

     cd e2e
    npm test