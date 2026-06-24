# Exception Management & Alerting Platform

A centralized platform where all applications send their errors to a single
endpoint (`POST /ingest`). The platform stores and categorizes errors, identifies
the source application, and provides a dashboard to view, search and analyze
exceptions. Administrators configure application ownership, teams, notification
groups, alert thresholds, escalation rules and notification channels (Email,
Slack, Teams, Webhook) from a central UI — no application code changes required.

```
 App 1   App 2   App 3   App 4
   \       |       |       /
    \      |       |      /
        POST /ingest
            |
   Central Error Platform
   ├── Store in Elasticsearch
   ├── Dashboard & Search
   ├── Alert Engine (thresholds)
   ├── Team / Ownership Management
   └── Escalation & Notifications
            |
   Email / Slack / Teams / Webhook
```

## Architecture

| Layer        | Tech                                            |
|--------------|-------------------------------------------------|
| Frontend     | Vite + React + TypeScript + Tailwind (Obsidian Flux theme, Space Grotesk), Recharts |
| Backend      | Node.js + Express + TypeScript                   |
| Auth         | JWT + bcrypt, role-based access (admin / editor / viewer) |
| Config store | PostgreSQL (users, apps, teams, groups, channels, thresholds, escalations, alerts) |
| Error store  | Elasticsearch (`exceptions` index — all logs)    |
| Notifications| Email (SMTP), Slack, Teams, generic Webhook      |

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL + Elasticsearch) — or your own instances

## Quick start

```bash
# 1. Start PostgreSQL + Elasticsearch
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run setup     # applies schema + ensures the Elasticsearch index
npm run dev       # API on http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev       # UI on http://localhost:5173
```

Open http://localhost:5173. On **first run** the app shows a **setup wizard** that
creates your admin account and (optionally) configures SMTP for email alerts.
After that you'll sign in with the credentials you chose.

> The platform starts **empty** — no demo data and no seeded users. It fills up
> as applications POST to `/ingest`. SMTP can be (re)configured any time from
> **Settings → SMTP / Email** (admin only).

> **Port note:** the bundled Postgres is mapped to host port **5433** (not 5432)
> to avoid clashing with a locally-installed Postgres. `DATABASE_URL` already
> reflects this.

### Generate sample traffic

```bash
node scripts/send-sample-errors.mjs 100
```

### Useful scripts (backend)

| Command | Description |
|---------|-------------|
| `npm run migrate` | Apply the database schema (idempotent) |
| `npm run seed` | Create the initial admin user + ES index |
| `npm run reset` | Wipe apps/exceptions/alerts (add `--users` to clear accounts too) |

## Authentication & roles

All `/api/*` endpoints require a JWT (obtained from `POST /api/auth/login`);
`/ingest` is public and authenticated per-application by ingest key. Roles:

- **Admin** — full access, including user management (`/users`).
- **Editor** — manage configuration; acknowledge/resolve alerts.
- **Viewer** — read-only.

## Deploying to production

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full production guide (managed
data stores, JWT secret, building the API & frontend, reverse-proxy config, and
a go-live checklist).

## The ingest contract

```http
POST /ingest
X-Api-Key: <application ingest key>   # optional; or send "app" in body
Content-Type: application/json

{
  "app": "payment-gateway-us",      // app slug or name (or use X-Api-Key)
  "type": "NullReferenceException",  // exception type
  "message": "Object reference not set",
  "stack": "...",                    // optional stack trace
  "severity": "critical",            // optional — auto-inferred if omitted
  "environment": "production",
  "host": "prod-web-04",
  "userId": "user_123",
  "tags": { "region": "us-east-1" }
}
```

On ingest the platform:
1. **Identifies the application** by `X-Api-Key` or `app`/`appSlug` (auto-registers unknown apps so nothing is dropped).
2. **Categorizes** the error — infers `severity` and a `category` (database, network, auth, …) and computes a stable `fingerprint` for grouping.
3. **Stores** the document in the Elasticsearch `exceptions` index.
4. **Evaluates alert thresholds** for that app (and global rules) and raises/escalates alerts, dispatching notifications to the app's routing group.

> Notifications run in **dry-run** mode by default (logged to console). Set
> `NOTIFICATIONS_LIVE=true` and configure SMTP / channel webhooks to send for real.
> Each channel has a **Send test** button (Settings) that always attempts a real
> delivery and reports success/failure, so you can validate a webhook anytime.

## Alerting & escalation

- **Thresholds** are evaluated on every ingested error (error count / error rate
  over a window, or "new error type"). A breach raises an **alert** and notifies
  the application's routing group immediately.
- A background **escalation worker** (in the API process) runs on a timer
  (`ESCALATION_TICK_MS`, default 15s). For each still-**open** (unacknowledged)
  alert it fires each escalation step once its `after_seconds` delay elapses,
  recording deliveries in `alert_escalations` so steps never double-fire.
- **Acknowledging or resolving** an alert stops further escalation automatically.

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ingest` | Central error intake (public, per-app key) |
| POST | `/api/auth/login` · GET `/api/auth/me` | Authentication |
| GET/POST/PATCH/DELETE | `/api/users` | User management (admin only) |
| GET | `/api/dashboard?range=24h` | KPIs, trend, top apps, recent feed |
| GET | `/api/exceptions` | Search/filter exceptions |
| GET/POST/PATCH/DELETE | `/api/applications` | Application registry & ownership |
| GET/POST/PATCH/DELETE | `/api/teams` | Teams |
| GET/POST/PATCH/DELETE | `/api/channels` · POST `/api/channels/:id/test` | Notification channels (+ live test) |
| GET/POST/PATCH/DELETE | `/api/notification-groups` | Notification groups |
| GET/POST/PATCH/DELETE | `/api/thresholds` | Alert thresholds |
| GET/POST/PATCH/DELETE | `/api/escalations` | Escalation steps |
| GET | `/api/alerts` · POST `/api/alerts/:id/acknowledge` · `/resolve` | Alert lifecycle |

## Project layout

```
backend/        Express API, alert engine, PG schema, ES client
frontend/       Vite React UI (Dashboard, Error Browser, Applications, …)
scripts/        Sample traffic generator
ui-design/      Original design reference (can be removed)
docker-compose.yml
```
