import { rows } from "../db/pool.js";
import { notifyGroup } from "./notify.js";

const TICK_MS = Number(process.env.ESCALATION_TICK_MS ?? 15000);

interface DueStep {
  alert_id: string;
  title: string;
  message: string | null;
  severity: string;
  app_name: string | null;
  rule_id: string;
  rule_message: string | null;
  notification_group_id: string | null;
  step_order: number;
}

/**
 * Fire every escalation step that has become due for currently-open
 * (unacknowledged) alerts and hasn't fired yet. Acknowledging or resolving an
 * alert (status != 'open') stops further escalation automatically.
 *
 * Idempotent: a row is claimed in alert_escalations *before* sending, so
 * overlapping ticks (or the immediate post-raise pass) never double-notify.
 */
export async function processDueEscalations(): Promise<number> {
  const due = await rows<DueStep>(`
    SELECT a.id AS alert_id, a.title, a.message, a.severity,
           app.name AS app_name,
           e.id AS rule_id, e.message AS rule_message,
           e.notification_group_id, e.step_order
      FROM alerts a
      JOIN escalation_rules e ON e.threshold_id = a.threshold_id
      LEFT JOIN applications app ON app.id = a.application_id
      LEFT JOIN alert_escalations ae
             ON ae.alert_id = a.id AND ae.escalation_rule_id = e.id
     WHERE a.status = 'open'
       AND ae.alert_id IS NULL
       AND now() >= a.triggered_at + make_interval(secs => e.after_seconds)
     ORDER BY a.triggered_at, e.step_order
  `);

  let fired = 0;
  for (const d of due) {
    // Claim the step first; if another tick already claimed it, skip.
    const claimed = await rows(
      `INSERT INTO alert_escalations (alert_id, escalation_rule_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING alert_id`,
      [d.alert_id, d.rule_id]
    );
    if (!claimed.length) continue;

    if (d.notification_group_id) {
      await notifyGroup(d.notification_group_id, {
        title: `[Escalation · step ${d.step_order}] ${d.title}`,
        message: d.rule_message ?? d.message ?? "",
        severity: d.severity,
        appName: d.app_name ?? undefined,
      });
    }
    fired++;
  }
  if (fired) console.log(`[escalationWorker] fired ${fired} escalation step(s)`);
  return fired;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startEscalationWorker() {
  if (timer) return;
  timer = setInterval(() => {
    processDueEscalations().catch((err) => console.error("[escalationWorker]", err));
  }, TICK_MS);
  console.log(`  Escalation worker running (tick every ${TICK_MS}ms)`);
}
