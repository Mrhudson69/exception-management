import { Router } from "express";
import { z } from "zod";
import { one, rows } from "../db/pool.js";

export const teamsRouter = Router();

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

teamsRouter.get("/", async (_req, res) => {
  const data = await rows(
    `SELECT t.*, count(a.id)::int AS app_count
       FROM teams t
       LEFT JOIN applications a ON a.owning_team_id = t.id
      GROUP BY t.id ORDER BY t.name ASC`
  );
  res.json(data);
});

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
});

teamsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const team = await one(
    `INSERT INTO teams (name, slug, description) VALUES ($1,$2,$3) RETURNING *`,
    [b.name, b.slug ? slugify(b.slug) : slugify(b.name), b.description ?? null]
  );
  res.status(201).json(team);
});

teamsRouter.patch("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const team = await one(
    `UPDATE teams SET name = COALESCE($2,name), description = COALESCE($3,description), updated_at = now()
      WHERE id = $1 RETURNING *`,
    [req.params.id, b.name ?? null, b.description ?? null]
  );
  if (!team) return res.status(404).json({ error: "not_found" });
  res.json(team);
});

teamsRouter.delete("/:id", async (req, res) => {
  await one(`DELETE FROM teams WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});
