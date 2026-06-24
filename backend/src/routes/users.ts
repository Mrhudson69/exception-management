import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one, rows } from "../db/pool.js";
import { requireRole } from "../auth/auth.js";

export const usersRouter = Router();

// All user-management endpoints are admin-only.
usersRouter.use(requireRole("admin"));

const PUBLIC = `id, email, name, role, active, last_login_at, created_at`;

usersRouter.get("/", async (_req, res) => {
  res.json(await rows(`SELECT ${PUBLIC} FROM users ORDER BY created_at ASC`));
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const existing = await one(`SELECT id FROM users WHERE email = $1`, [b.email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: "email_taken" });
  const hash = await bcrypt.hash(b.password, 10);
  const user = await one(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)
     RETURNING ${PUBLIC}`,
    [b.email.toLowerCase(), b.name, hash, b.role ?? "viewer"]
  );
  res.status(201).json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const hash = b.password ? await bcrypt.hash(b.password, 10) : null;
  const user = await one(
    `UPDATE users SET
        name = COALESCE($2, name),
        role = COALESCE($3, role),
        active = COALESCE($4, active),
        password_hash = COALESCE($5, password_hash),
        updated_at = now()
      WHERE id = $1 RETURNING ${PUBLIC}`,
    [req.params.id, b.name ?? null, b.role ?? null, b.active ?? null, hash]
  );
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json(user);
});

usersRouter.delete("/:id", async (req, res) => {
  // Prevent deleting the last admin or yourself by accident.
  if (req.user?.id === req.params.id) return res.status(400).json({ error: "cannot_delete_self" });
  const admins = await rows(`SELECT id FROM users WHERE role = 'admin' AND active = true`);
  const target = await one<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
  if (target?.role === "admin" && admins.length <= 1) {
    return res.status(400).json({ error: "cannot_delete_last_admin" });
  }
  await one(`DELETE FROM users WHERE id = $1 RETURNING id`, [req.params.id]);
  res.status(204).end();
});
