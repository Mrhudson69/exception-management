import cors from "cors";
import express from "express";
import morgan from "morgan";
import { config } from "./config.js";
import { ensureExceptionsIndex } from "./es/client.js";
import { ingestRouter } from "./routes/ingest.js";
import { exceptionsRouter } from "./routes/exceptions.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { applicationsRouter } from "./routes/applications.js";
import { teamsRouter } from "./routes/teams.js";
import { channelsRouter } from "./routes/channels.js";
import { notificationGroupsRouter } from "./routes/notificationGroups.js";
import { thresholdsRouter } from "./routes/thresholds.js";
import { escalationsRouter } from "./routes/escalations.js";
import { alertsRouter } from "./routes/alerts.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { settingsRouter } from "./routes/settings.js";
import { requireAuth, writeGuard } from "./auth/auth.js";
import { startEscalationWorker } from "./services/escalationWorker.js";

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// The central ingestion endpoint that every application POSTs errors to.
// Public: applications authenticate with their per-app ingest key, not a user token.
app.use("/ingest", ingestRouter);

// Authentication (public).
app.use("/api/auth", authRouter);

// Runtime metadata for the UI (e.g. whether notifications are sent live).
app.get("/api/meta", requireAuth, (_req, res) => {
  res.json({ notificationsLive: config.notificationsLive });
});

// Everything below requires a logged-in user. Reads are allowed for any role;
// writes (POST/PATCH/DELETE) require editor or admin via writeGuard.
app.use("/api/users", requireAuth, usersRouter); // admin-only enforced inside
app.use("/api/settings", requireAuth, settingsRouter); // admin-only enforced inside
app.use("/api/exceptions", requireAuth, exceptionsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/applications", requireAuth, writeGuard, applicationsRouter);
app.use("/api/teams", requireAuth, writeGuard, teamsRouter);
app.use("/api/channels", requireAuth, writeGuard, channelsRouter);
app.use("/api/notification-groups", requireAuth, writeGuard, notificationGroupsRouter);
app.use("/api/thresholds", requireAuth, writeGuard, thresholdsRouter);
app.use("/api/escalations", requireAuth, writeGuard, escalationsRouter);
app.use("/api/alerts", requireAuth, writeGuard, alertsRouter);

// Central error handler.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  res.status(err.status ?? 500).json({ error: err.message ?? "internal_error" });
});

async function start() {
  try {
    await ensureExceptionsIndex();
  } catch (err) {
    console.warn("⚠ Could not reach Elasticsearch on startup. Ingest/search may fail until it is up.");
  }
  startEscalationWorker();
  app.listen(config.port, () => {
    console.log(`\n  Exception Management API listening on http://localhost:${config.port}`);
    console.log(`  Ingest endpoint:  POST http://localhost:${config.port}/ingest`);
    console.log(`  Notifications:    ${config.notificationsLive ? "LIVE" : "dry-run (set NOTIFICATIONS_LIVE=true)"}\n`);
  });
}

start();
