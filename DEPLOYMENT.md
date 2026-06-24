# Production Deployment Guide

This guide covers deploying the Exception Management & Alerting Platform to
production. There are three moving parts: **PostgreSQL**, **Elasticsearch**, and
the **Node API**, plus the **static frontend** build.

---

## 1. Architecture in production

```
            ┌─────────────┐
 apps ───▶  │  Reverse    │  /ingest, /api  ──▶  Node API (PM2 / container)
            │  proxy      │                         │
 users ──▶  │ (nginx /    │  /  (static)            ├──▶ PostgreSQL (managed)
            │  Caddy /    │  ──▶ frontend dist       └──▶ Elasticsearch (managed)
            │  ALB)       │
            └─────────────┘
```

- Terminate **TLS** at the proxy. Never expose Postgres/Elasticsearch publicly.
- The API is stateless — run **2+ replicas** behind the proxy for HA.
- Serve the frontend as static files (CDN or the proxy); it talks to the API
  over `/api` and `/ingest` on the same origin.

---

## 2. Provision data stores

**PostgreSQL** — use a managed service (RDS, Cloud SQL, Neon, Supabase) or a
hardened container. Create a database and user, then set `DATABASE_URL`.

**Elasticsearch** — use Elastic Cloud or a managed OpenSearch, or self-host with
security **enabled**. Set `ELASTICSEARCH_URL` (and auth — see below). For
real volume, configure an **index lifecycle policy (ILM)** to roll over and
delete old `exceptions` indices.

> The bundled `docker-compose.yml` runs both **without security** for local dev
> only. Do not use that compose file as-is in production.

---

## 3. Configure environment

Create a production `.env` (or inject via your platform's secret manager):

```bash
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://ops.yourcompany.com          # your frontend origin

DATABASE_URL=postgres://user:pass@db-host:5432/exmgmt
ELASTICSEARCH_URL=https://es-host:9243
ES_EXCEPTIONS_INDEX=exceptions

# AUTH — generate a long random secret:  openssl rand -hex 48
JWT_SECRET=<64+ random chars>
JWT_EXPIRES_IN=7d
SEED_ADMIN_EMAIL=you@yourcompany.com
SEED_ADMIN_PASSWORD=<strong one-time password>

# Notifications (set live + real creds to actually send)
NOTIFICATIONS_LIVE=true
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<secret>
SMTP_FROM="Exception Platform <alerts@yourcompany.com>"
```

**Security must-dos**
- Set a strong, unique `JWT_SECRET`. Rotating it invalidates all sessions.
- Change the seeded admin password on first login (or set a strong one above).
- If Elasticsearch security is on, add credentials to `ELASTICSEARCH_URL`
  (`https://user:pass@host`) or extend `backend/src/es/client.ts` with an
  `auth` block / API key.

---

## 4. Build & run the backend

```bash
cd backend
npm ci
npm run build          # compiles TypeScript -> dist/
npm run migrate        # applies schema (idempotent)
npm run seed           # creates the admin user + ES index (run once)
node dist/index.js     # or via PM2 / systemd / container
```

Run under a process manager so it restarts on crash:

```bash
pm2 start dist/index.js --name exmgmt-api -i 2   # 2 clustered instances
```

### Containerizing the API (optional)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## 5. Build & serve the frontend

```bash
cd frontend
npm ci
npm run build          # outputs static files to frontend/dist/
```

Serve `frontend/dist/` from your CDN or proxy. Because it's a SPA, route all
unknown paths to `index.html`. Example **nginx**:

```nginx
server {
  listen 443 ssl;
  server_name ops.yourcompany.com;

  root /var/www/exmgmt;            # contents of frontend/dist
  index index.html;

  location /api/    { proxy_pass http://api_upstream; }
  location /ingest  { proxy_pass http://api_upstream; }
  location /        { try_files $uri /index.html; }   # SPA fallback
}
upstream api_upstream { server 127.0.0.1:4000; }   # add more for HA
```

> In dev, Vite proxies `/api` and `/ingest` to `localhost:4000`. In production
> that routing is the reverse proxy's job (above) — same-origin, no CORS needed.

---

## 6. Operational notes

- **Health check**: `GET /health` returns `{ status: "ok" }` — wire it to your
  load balancer.
- **Scaling**: the API is stateless; scale horizontally. The alert engine and
  the in-process **escalation worker** de-dupe in Postgres (alert de-dup +
  `alert_escalations` claim rows), so running multiple instances is safe — each
  escalation step is delivered exactly once. Tune the cadence with
  `ESCALATION_TICK_MS` (default 15000).
- **Backups**: back up PostgreSQL (config + users + alerts). Exceptions in
  Elasticsearch are high-volume telemetry; use ILM + snapshots as needed.
- **Wipe data**: `npm run reset` clears apps/exceptions/alerts (keeps users);
  add `--users` to also clear accounts.
- **Rotating ingest keys**: per-app keys can be rotated from the Applications
  screen without redeploying the sending apps' code (update their config).
- **Logs**: the API logs requests via `morgan`. Ship stdout to your log stack.

---

## 7. Quick production checklist

- [ ] Managed Postgres + Elasticsearch with security enabled
- [ ] Strong `JWT_SECRET`, admin password changed
- [ ] `CORS_ORIGIN` set to the real frontend origin
- [ ] TLS terminated at the proxy; data stores not publicly reachable
- [ ] `npm run migrate` + `npm run seed` run once against prod DB
- [ ] API behind a process manager / orchestrator with `/health` checks
- [ ] Frontend `dist/` served with SPA fallback
- [ ] `NOTIFICATIONS_LIVE=true` + SMTP/Slack/Teams creds configured
- [ ] Elasticsearch ILM policy for the `exceptions` index
```
