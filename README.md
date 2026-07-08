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

## Hosting it so you can both use it from a browser

In production the backend serves the built frontend itself (`server/src/index.js` serves `client/dist` and falls back to `index.html` for client-side routes), so the whole app is one deployable service — one URL, no separate frontend host, no CORS to configure. A root `Dockerfile` builds the client and runs the server.

SQLite needs a **persistent disk** — most free container platforms wipe the filesystem on redeploy/restart, which would delete your data. Set `DB_PATH` to a path on a mounted volume.

### Recommended: Railway (free tier, ~5 minutes)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On [railway.app](https://railway.app), "New Project" → "Deploy from GitHub repo" → pick this repo. Railway detects the `Dockerfile` automatically.
3. Add a **Volume**: Settings → Volumes → mount at `/data`.
4. Set environment variables under Settings → Variables:
   - `JWT_SECRET` — any long random string (auth tokens are signed with this)
   - `DB_PATH` — `/data/data.sqlite`
5. Settings → Networking → "Generate Domain" gives you a public `https://your-app.up.railway.app` URL. Open it in a browser — that's the app for both of you.

### Alternatives

- **Fly.io** — same Dockerfile works; create a volume with `fly volumes create data --size 1` and mount it at `/data` in `fly.toml`, set `JWT_SECRET`/`DB_PATH` as secrets.
- **Render** — Web Service from the Dockerfile; persistent disks are a paid add-on on Render, so this is the priciest of the three for keeping data.
- **A small VPS** (DigitalOcean, Hetzner, etc.) — most control, but you're responsible for HTTPS (e.g. via Caddy/Let's Encrypt) and updates. Overkill unless you already run one.

Whichever you pick, always set a real `JWT_SECRET` in production — the default in the code is only for local dev.
