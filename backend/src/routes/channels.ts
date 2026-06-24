import { Router } from "express";
import { z } from "zod";
import { one, rows } from "../db/pool.js";
import { deliverToChannel, type ChannelRow } from "../services/notify.js";

export const channelsRouter = Router();

channelsRouter.get("/", async (_req, res) => {
  res.json(await rows(`SELECT * FROM notification_channels ORDER BY name ASC`));
});

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["email", "slack", "teams", "webhook"]),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
});

channelsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ch = await one(
    `INSERT INTO notification_channels (name, type, config, enabled)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [b.name, b.type, b.config ?? {}, b.enabled ?? true]
  );
  res.status(201).json(ch);
});

channelsRouter.patch("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ch = await one(
    `UPDATE notification_channels SET
        name = COALESCE($2,name),
        type = COALESCE($3,type),
        config = COALESCE($4,config),
        enabled = COALESCE($5,enabled),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id, b.name ?? null, b.type ?? null, b.config ?? null, b.enabled ?? null]
  );
  if (!ch) return res.status(404).json({ error: "not_found" });
  res.json(ch);
});

channelsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM notification_channels WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});

/**
 * Send a live test notification to this channel so admins can verify a webhook
 * works. This always attempts a real delivery (ignores the global dry-run flag).
 */
channelsRouter.post("/:id/test", async (req, res) => {
  const channel = await one<ChannelRow>(
    `SELECT id, name, type, config FROM notification_channels WHERE id = $1`,
    [req.params.id]
  );
  if (!channel) return res.status(404).json({ error: "not_found" });
  try {
    await deliverToChannel(channel, {
      title: "Test notification",
      message: `This is a test message from OpsConsole for channel "${channel.name}".`,
      severity: "info",
    });
    res.json({ sent: true });
  } catch (err: any) {
    res.status(502).json({ sent: false, error: err?.message ?? "delivery_failed" });
  }
});
