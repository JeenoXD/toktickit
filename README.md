# TokTickIT

IT service desk application — CPE334 Lab 1 

## Prerequisites

- Node.js 
- npm
- PostgreSQL

## Project structure

toktickit/
├── client/   
├── server/   
└── docs/     

## Setup

### 1. Install dependencies
cd server && npm install
cd ../client && npm install

### 2. Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env

## Running the app

**Backend** (http://localhost:3000):
cd server && npm run dev

**Frontend** (http://localhost:5173):
cd client && npm run dev

Click **Check System** to verify the backend is reachable. It calls `GET /api/health`
and shows **Online** or **Offline** with an error message if the backend is unreachable.

## Running tests
cd server && npm test
cd client && npm test

## Tech stack

React, TypeScript, Vite, Bootstrap · Node.js, Express, TypeScript · PostgreSQL, Prisma · Vitest, Supertest