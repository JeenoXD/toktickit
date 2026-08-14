# TokTickIT

IT service desk application — CPE334 Lab 1 full-stack starter (React + Express + Prisma + PostgreSQL).

## Prerequisites

- Node.js
- npm
- PostgreSQL

## Project structure

```
toktickit/

├── client/   React + TypeScript + Vite + Bootstrap frontend
├── server/   Node + Express + TypeScript + Prisma backend
└── docs/     Lab documentation
```

## Setup

### 1. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

### 2. Configure environment variables

```bash
# from the repo root
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set `DATABASE_URL` to point at your PostgreSQL instance.

### 3. Start PostgreSQL

Using Docker:

```bash
docker run --name toktickit-postgres -e POSTGRES_USER=toktickit -e POSTGRES_PASSWORD=toktickit -e POSTGRES_DB=toktickit -p 5432:5432 -d postgres:16
```

This matches the default `DATABASE_URL` in `.env.example`, so no further edits are needed if you use it as-is.

### 4. Run the database migration and seed

```bash
cd server
npx prisma migrate dev --name init
npm run prisma:seed
```

This creates the `Category` table and inserts the four supported categories: Account and Access, Hardware, Software, Network. The seed is safe to run more than once — it won't create duplicates.

## Running the app

**Backend** (http://localhost:3000):
```bash
cd server
npm run dev
```

**Frontend** (http://localhost:5173):
```bash
cd client
npm run dev
```

Click **Check System**:
- Calls `GET /api/health` to confirm the backend is reachable.
- Calls `GET /api/categories` and lists the categories loaded from PostgreSQL.
- Shows **Online** with the category list on success, or **Offline** with an error message if the backend or database is unavailable.

## Running tests

```bash
cd server
npm test

cd client
npm test
```

## Tech stack

React, TypeScript, Vite, Bootstrap · Node.js, Express, TypeScript · PostgreSQL, Prisma · Vitest, Supertest