# Our Budget — a spending & budgeting tracker for two

A small full-stack app for couples to track shared spending and budgets together. Both partners log in to the same household and see the same live data.

## Features

- **Shared household accounts** — one person creates a household and gets an invite code; the other joins with it. Every expense, budget, bill, and goal is scoped to the household.
- **Expense tracking with splitting** — log who paid, then split the cost equally, with a custom split, or mark it as personal (not shared).
- **Monthly category budgets** — set a budget per category per month and see spend-vs-budget progress bars.
- **Balance / who-owes-whom** — the dashboard computes each partner's net position from all expense splits and shows a one-line settlement ("Sam owes Alex $72.25").
- **Recurring bills** — rent, subscriptions, utilities, etc. with a due day and a "mark paid" flow that logs it as an expense for that month.
- **Savings goals** — shared goals with a target amount/date and a running list of contributions from either partner.

## Stack

- **Backend**: Node.js, Express, SQLite (via `better-sqlite3`), JWT auth — `server/`
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, Recharts — `client/`

## Running locally

```bash
# Backend (http://localhost:4000)
cd server
npm install
npm start

# Frontend (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so just open `http://localhost:5173`.

The first person to sign up should use "Create household" — this returns an invite code to share with their partner, who signs up with "Join with code".

Data is stored in `server/data.sqlite` (created automatically, gitignored).
