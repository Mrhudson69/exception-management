import { Router } from "express";
import { one, rows } from "../db/pool.js";
import { getAppScope } from "../auth/scope.js";

export const alertsRouter = Router();

alertsRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const scope = await getAppScope(req.user!);
  const params: any[] = [];
  const conditions: string[] = [];
  if (status) {
    params.push(status);
    conditions.push(`al.status = $${params.length}`);
  }
  // Restrict to applications this user is allowed to see.
  if (!scope.all) {
    params.push(scope.ids);
    conditions.push(`al.application_id = ANY($${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  res.json(
    await rows(
      `SELECT al.*, a.name AS application_name, th.name AS threshold_name
         FROM alerts al
         LEFT JOIN applications a ON a.id = al.application_id
         LEFT JOIN thresholds th ON th.id = al.threshold_id
         ${where}
        ORDER BY al.triggered_at DESC LIMIT 200`,
      params
    )
  );
});

alertsRouter.post("/:id/acknowledge", async (req, res) => {
  const al = await one(
    `UPDATE alerts SET status = 'acknowledged', acknowledged_at = now()
      WHERE id = $1 AND status = 'open' RETURNING *`,
    [req.params.id]
  );
  if (!al) return res.status(404).json({ error: "not_found_or_not_open" });
  res.json(al);
});

alertsRouter.post("/:id/resolve", async (req, res) => {
  const al = await one(
    `UPDATE alerts SET status = 'resolved', resolved_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!al) return res.status(404).json({ error: "not_found" });
  res.json(al);
});
