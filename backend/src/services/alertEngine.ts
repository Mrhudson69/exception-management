import { es, EXCEPTIONS_INDEX } from "../es/client.js";
import { one, rows } from "../db/pool.js";
import { notifyGroup } from "./notify.js";
import { processDueEscalations } from "./escalationWorker.js";

interface ThresholdRow {
  id: string;
  name: string;
  application_id: string | null;
  metric: "error_count" | "error_rate" | "new_error_type";
  comparator: ">" | ">=" | "<" | "<=" | "==";
  threshold_value: string; // numeric comes back as string
  window_seconds: number;
  severity: string;
  enabled: boolean;
}

interface AppContext {
  id: string;
  name: string;
  slug: string;
  notification_group_id: string | null;
}

function compare(value: number, comparator: string, threshold: number): boolean {
  switch (comparator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return value === threshold;
    default:
      return false;
  }
}

async function countInWindow(appSlug: string, windowSeconds: number): Promise<number> {
  const res = await es.count({
    index: EXCEPTIONS_INDEX,
    query: {
      bool: {
        filter: [
          { term: { app_slug: appSlug } },
          { range: { timestamp: { gte: `now-${windowSeconds}s` } } },
        ],
      },
    },
  });
  return res.count;
}

/**
 * Evaluate all thresholds relevant to an application after an event is ingested.
 * Creates or de-duplicates alerts and fires the first escalation step.
 */
export async function evaluateThresholds(
  app: AppContext,
  event: { fingerprint: string; isNewType: boolean; severity: string }
): Promise<void> {
  const thresholds = await rows<ThresholdRow>(
    `SELECT * FROM thresholds
      WHERE enabled = true AND (application_id = $1 OR application_id IS NULL)`,
    [app.id]
  );

  for (const t of thresholds) {
    let observed = 0;
    let breached = false;

    if (t.metric === "error_count") {
      observed = await countInWindow(app.slug, t.window_seconds);
      breached = compare(observed, t.comparator, Number(t.threshold_value));
    } else if (t.metric === "new_error_type") {
      observed = 1;
      breached = event.isNewType;
    } else if (t.metric === "error_rate") {
      // events per minute over the window
      const total = await countInWindow(app.slug, t.window_seconds);
      observed = Number((total / Math.max(1, t.window_seconds / 60)).toFixed(2));
      breached = compare(observed, t.comparator, Number(t.threshold_value));
    }

    if (breached) {
      await raiseAlert(t, app, observed);
    }
  }
}

async function raiseAlert(t: ThresholdRow, app: AppContext, observed: number) {
  // De-dupe: if an open alert already exists for this threshold+app, bump it.
  const existing = await one<{ id: string }>(
    `SELECT id FROM alerts
      WHERE threshold_id = $1 AND application_id = $2 AND status = 'open'
        AND triggered_at > now() - ($3 || ' seconds')::interval
      ORDER BY triggered_at DESC LIMIT 1`,
    [t.id, app.id, t.window_seconds]
  );

  if (existing) {
    await one(
      `UPDATE alerts SET event_count = event_count + 1, observed_value = $2
        WHERE id = $1 RETURNING id`,
      [existing.id, observed]
    );
    return;
  }

  const title = `${t.name} on ${app.name}`;
  const message = `Threshold "${t.name}" breached: observed ${observed} (${t.comparator} ${t.threshold_value}) over ${t.window_seconds}s.`;

  await one(
    `INSERT INTO alerts (threshold_id, application_id, severity, status, title, message, observed_value)
     VALUES ($1, $2, $3, 'open', $4, $5, $6) RETURNING id`,
    [t.id, app.id, t.severity, title, message, observed]
  );

  // Notify the application's routing group immediately for the alert itself.
  await notifyGroup(app.notification_group_id, {
    title,
    message,
    severity: t.severity,
    appName: app.name,
  });

  // Ordered escalation steps are owned by the background worker. Kick an
  // immediate pass so any step with after_seconds=0 fires right away; later
  // steps fire on subsequent ticks while the alert stays unacknowledged.
  processDueEscalations().catch((err) => console.error("[alertEngine] escalation pass", err));
}
