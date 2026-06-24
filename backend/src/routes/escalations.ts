import { Router } from "express";
import { z } from "zod";
import { one, rows } from "../db/pool.js";

export const escalationsRouter = Router();

escalationsRouter.get("/", async (_req, res) => {
  res.json(
    await rows(
      `SELECT e.*, th.name AS threshold_name, g.name AS notification_group_name
         FROM escalation_rules e
         LEFT JOIN thresholds th ON th.id = e.threshold_id
         LEFT JOIN notification_groups g ON g.id = e.notification_group_id
        ORDER BY th.name, e.step_order ASC`
    )
  );
});

const schema = z.object({
  name: z.string().min(1),
  thresholdId: z.string().uuid().nullable().optional(),
  stepOrder: z.number().int().optional(),
  afterSeconds: z.number().int().nonnegative().optional(),
  notificationGroupId: z.string().uuid().nullable().optional(),
  message: z.string().optional(),
});

escalationsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const e = await one(
    `INSERT INTO escalation_rules (name, threshold_id, step_order, after_seconds, notification_group_id, message)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      b.name,
      b.thresholdId ?? null,
      b.stepOrder ?? 1,
      b.afterSeconds ?? 0,
      b.notificationGroupId ?? null,
      b.message ?? null,
    ]
  );
  res.status(201).json(e);
});

escalationsRouter.patch("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const e = await one(
    `UPDATE escalation_rules SET
        name = COALESCE($2,name),
        threshold_id = $3,
        step_order = COALESCE($4,step_order),
        after_seconds = COALESCE($5,after_seconds),
        notification_group_id = $6,
        message = COALESCE($7,message)
      WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      b.name ?? null,
      b.thresholdId ?? null,
      b.stepOrder ?? null,
      b.afterSeconds ?? null,
      b.notificationGroupId ?? null,
      b.message ?? null,
    ]
  );
  if (!e) return res.status(404).json({ error: "not_found" });
  res.json(e);
});

escalationsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM escalation_rules WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});
