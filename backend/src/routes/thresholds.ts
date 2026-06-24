import { Router } from "express";
import { z } from "zod";
import { one, rows } from "../db/pool.js";

export const thresholdsRouter = Router();

thresholdsRouter.get("/", async (_req, res) => {
  res.json(
    await rows(
      `SELECT th.*, a.name AS application_name
         FROM thresholds th
         LEFT JOIN applications a ON a.id = th.application_id
        ORDER BY th.created_at DESC`
    )
  );
});

const schema = z.object({
  name: z.string().min(1),
  applicationId: z.string().uuid().nullable().optional(),
  metric: z.enum(["error_count", "error_rate", "new_error_type"]).optional(),
  comparator: z.enum([">", ">=", "<", "<=", "=="]).optional(),
  thresholdValue: z.number().optional(),
  windowSeconds: z.number().int().positive().optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  enabled: z.boolean().optional(),
});

thresholdsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const t = await one(
    `INSERT INTO thresholds (name, application_id, metric, comparator, threshold_value, window_seconds, severity, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      b.name,
      b.applicationId ?? null,
      b.metric ?? "error_count",
      b.comparator ?? ">",
      b.thresholdValue ?? 10,
      b.windowSeconds ?? 300,
      b.severity ?? "warning",
      b.enabled ?? true,
    ]
  );
  res.status(201).json(t);
});

thresholdsRouter.patch("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const t = await one(
    `UPDATE thresholds SET
        name = COALESCE($2,name),
        application_id = $3,
        metric = COALESCE($4,metric),
        comparator = COALESCE($5,comparator),
        threshold_value = COALESCE($6,threshold_value),
        window_seconds = COALESCE($7,window_seconds),
        severity = COALESCE($8,severity),
        enabled = COALESCE($9,enabled),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      b.name ?? null,
      b.applicationId ?? null,
      b.metric ?? null,
      b.comparator ?? null,
      b.thresholdValue ?? null,
      b.windowSeconds ?? null,
      b.severity ?? null,
      b.enabled ?? null,
    ]
  );
  if (!t) return res.status(404).json({ error: "not_found" });
  res.json(t);
});

thresholdsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM thresholds WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});
