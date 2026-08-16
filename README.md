# TokTickIT

IT service desk app — CPE334 Lab 1 

## Project Setup Instructions

### 1. Database & Server (Backend)

1. Open a terminal and navigate to the `server` folder: `cd server`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your PostgreSQL database URL.
4. Start PostgreSQL (Docker): `docker run --name toktickit-postgres -e POSTGRES_USER=toktickit -e POSTGRES_PASSWORD=toktickit -e POSTGRES_DB=toktickit -p 5432:5432 -d postgres:16`
5. Run Prisma migration: `npx prisma migrate dev`
6. Seed the categories: `npm run prisma:seed`
7. Start the backend server: `npm run dev`

### 2. Client (Frontend)

1. Open a new terminal and navigate to the `client` folder: `cd client`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Start the Vite development server: `npm run dev`

### 3. Try it out

Click **Check System** on the page. It calls the backend health check and category list, and shows Online with the categories, or Offline with an error message if the backend/database isn't reachable.

### 4. Running tests

Backend: `cd server` then `npm test`

Frontend: `cd client` then `npm test`