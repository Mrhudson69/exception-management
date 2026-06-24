import { Router } from "express";
import { z } from "zod";
import { one, query, rows } from "../db/pool.js";

export const notificationGroupsRouter = Router();

/** List groups with their attached channels. */
notificationGroupsRouter.get("/", async (_req, res) => {
  const groups = await rows(`SELECT * FROM notification_groups ORDER BY name ASC`);
  const links = await rows<{ group_id: string; id: string; name: string; type: string }>(
    `SELECT gc.group_id, c.id, c.name, c.type
       FROM notification_group_channels gc
       JOIN notification_channels c ON c.id = gc.channel_id`
  );
  res.json(
    groups.map((g: any) => ({
      ...g,
      channels: links.filter((l) => l.group_id === g.id).map(({ id, name, type }) => ({ id, name, type })),
    }))
  );
});

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  emails: z.array(z.string().email()).optional(),
  channelIds: z.array(z.string().uuid()).optional(),
});

async function setChannels(groupId: string, channelIds: string[]) {
  await query(`DELETE FROM notification_group_channels WHERE group_id = $1`, [groupId]);
  for (const cid of channelIds) {
    await query(
      `INSERT INTO notification_group_channels (group_id, channel_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [groupId, cid]
    );
  }
}

notificationGroupsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const group = await one<{ id: string }>(
    `INSERT INTO notification_groups (name, description, emails) VALUES ($1,$2,$3) RETURNING *`,
    [b.name, b.description ?? null, b.emails ?? []]
  );
  if (group && b.channelIds) await setChannels(group.id, b.channelIds);
  res.status(201).json(group);
});

notificationGroupsRouter.patch("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const group = await one(
    `UPDATE notification_groups SET
        name = COALESCE($2,name),
        description = COALESCE($3,description),
        emails = COALESCE($4,emails),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id, b.name ?? null, b.description ?? null, b.emails ?? null]
  );
  if (!group) return res.status(404).json({ error: "not_found" });
  if (b.channelIds) await setChannels(req.params.id, b.channelIds);
  res.json(group);
});

notificationGroupsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM notification_groups WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});
