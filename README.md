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

- **Backend**: Node.js, Express, PostgreSQL (via `pg`), JWT auth — `server/`
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, Recharts — `client/`

## Running locally

You need a Postgres database. Easiest local option: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`, or install Postgres directly.

```bash
# Backend (http://localhost:4000)
cd server
npm install
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" npm start

# Frontend (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so just open `http://localhost:5173`. The server creates all tables automatically on first boot (`CREATE TABLE IF NOT EXISTS`).

The first person to sign up should use "Create household" — this returns an invite code to share with their partner, who signs up with "Join with code".

## Hosting it so you can both use it from a browser

In production the backend serves the built frontend itself (`server/src/index.js` serves `client/dist` and falls back to `index.html` for client-side routes), so the whole app is one deployable service — one URL, no separate frontend host, no CORS to configure. A root `Dockerfile` builds the client and runs the server.

### Recommended: Railway (free, no credit card required)

Railway's free Trial plan locks the generic "Volumes" feature behind adding a payment method, but its managed **Postgres** database is a separate, first-class service that's available on the free trial — which is why this app uses Postgres rather than a SQLite file on disk.

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On [railway.app](https://railway.app), start a **New Project** → "Deploy from GitHub repo" → pick this repo. Railway detects the root `Dockerfile` automatically and deploys it as a service.
3. In the same project, click **+ New** → **Database** → **Add PostgreSQL**. Railway provisions it and exposes a `DATABASE_URL`.
4. On your app service → **Variables**, add:
   - `JWT_SECRET` — any long random string (auth tokens are signed with this)
   - `DATABASE_URL` — reference the Postgres service's variable (Railway lets you pick `${{Postgres.DATABASE_URL}}` from a dropdown, so it's always in sync)
5. App service → **Settings** → **Networking** → "Generate Domain" gives you a public `https://your-app.up.railway.app` URL. Open it in a browser — that's the app for both of you.

### Alternatives

- **Fly.io** — same Dockerfile works; `fly postgres create` gives you a free-tier Postgres instance, attach it to your app with `fly postgres attach`, which sets `DATABASE_URL` automatically.
- **Render** — Web Service from the Dockerfile, plus Render's free-tier Postgres (expires after 90 days on the free plan, worth knowing going in).
- **A small VPS** (DigitalOcean, Hetzner, etc.) — most control, run Postgres alongside the app yourself, but you're responsible for HTTPS (e.g. via Caddy/Let's Encrypt) and updates. Overkill unless you already run one.

Whichever you pick, always set a real `JWT_SECRET` in production — the default in the code is only for local dev.
