import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { one, rows } from "../db/pool.js";
import { es, EXCEPTIONS_INDEX } from "../es/client.js";

export const applicationsRouter = Router();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** GET /api/applications — list with team/group names and 24h error counts. */
applicationsRouter.get("/", async (_req, res) => {
  const apps = await rows(
    `SELECT a.*, t.name AS owning_team_name, g.name AS notification_group_name
       FROM applications a
       LEFT JOIN teams t ON t.id = a.owning_team_id
       LEFT JOIN notification_groups g ON g.id = a.notification_group_id
      ORDER BY a.name ASC`
  );

  // Enrich with 24h error counts from Elasticsearch.
  let counts: Record<string, number> = {};
  try {
    const agg = await es.search({
      index: EXCEPTIONS_INDEX,
      size: 0,
      query: { range: { timestamp: { gte: "now-24h" } } },
      aggs: { apps: { terms: { field: "app_slug", size: 500 } } },
    });
    for (const b of (agg.aggregations?.apps as any)?.buckets ?? []) {
      counts[b.key] = b.doc_count;
    }
  } catch {
    /* index may not exist yet */
  }

  res.json(apps.map((a: any) => ({ ...a, errors24h: counts[a.slug] ?? 0 })));
});

const appSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  environment: z.string().optional(),
  status: z.enum(["healthy", "warning", "degraded", "critical", "suspended"]).optional(),
  owningTeamId: z.string().uuid().nullable().optional(),
  notificationGroupId: z.string().uuid().nullable().optional(),
});

applicationsRouter.post("/", async (req, res) => {
  const parsed = appSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const slug = b.slug ? slugify(b.slug) : slugify(b.name);
  const ingestKey = `ik_${randomBytes(16).toString("hex")}`;
  const app = await one(
    `INSERT INTO applications (name, slug, ingest_key, description, environment, status, owning_team_id, notification_group_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      b.name,
      slug,
      ingestKey,
      b.description ?? null,
      b.environment ?? "production",
      b.status ?? "healthy",
      b.owningTeamId ?? null,
      b.notificationGroupId ?? null,
    ]
  );
  res.status(201).json(app);
});

applicationsRouter.patch("/:id", async (req, res) => {
  const parsed = appSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const app = await one(
    `UPDATE applications SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        environment = COALESCE($4, environment),
        status = COALESCE($5, status),
        owning_team_id = $6,
        notification_group_id = $7,
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      b.name ?? null,
      b.description ?? null,
      b.environment ?? null,
      b.status ?? null,
      b.owningTeamId ?? null,
      b.notificationGroupId ?? null,
    ]
  );
  if (!app) return res.status(404).json({ error: "not_found" });
  res.json(app);
});

applicationsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM applications WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});

/** Rotate the ingest key. */
applicationsRouter.post("/:id/rotate-key", async (req, res) => {
  const ingestKey = `ik_${randomBytes(16).toString("hex")}`;
  const app = await one(
    `UPDATE applications SET ingest_key = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, ingestKey]
  );
  if (!app) return res.status(404).json({ error: "not_found" });
  res.json(app);
});
