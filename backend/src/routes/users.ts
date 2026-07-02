import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one, query, rows } from "../db/pool.js";
import { requireRole } from "../auth/auth.js";

export const usersRouter = Router();

// All user-management endpoints are admin-only.
usersRouter.use(requireRole("admin"));

// Base columns plus the assigned application ids (empty when all_applications).
const SELECT_USERS = `
  SELECT u.id, u.email, u.name, u.role, u.active, u.last_login_at, u.created_at, u.all_applications,
         COALESCE(array_agg(ua.application_id::text) FILTER (WHERE ua.application_id IS NOT NULL), '{}') AS application_ids
    FROM users u
    LEFT JOIN user_applications ua ON ua.user_id = u.id`;

async function fetchUser(id: string) {
  return one(`${SELECT_USERS} WHERE u.id = $1 GROUP BY u.id`, [id]);
}

/** Replace a user's application assignments. When allApplications is true the
 *  join rows are cleared (the flag alone grants full visibility). */
async function setUserApplications(userId: string, allApplications: boolean, applicationIds: string[]) {
  await query(`DELETE FROM user_applications WHERE user_id = $1`, [userId]);
  if (!allApplications && applicationIds.length) {
    const values = applicationIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    await query(
      `INSERT INTO user_applications (user_id, application_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [userId, ...applicationIds]
    );
  }
}

usersRouter.get("/", async (_req, res) => {
  res.json(await rows(`${SELECT_USERS} GROUP BY u.id ORDER BY u.created_at ASC`));
});

const accessSchema = {
  allApplications: z.boolean().optional(),
  applicationIds: z.array(z.string().uuid()).optional(),
};

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  ...accessSchema,
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const existing = await one(`SELECT id FROM users WHERE email = $1`, [b.email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: "email_taken" });
  const hash = await bcrypt.hash(b.password, 10);
  const allApps = b.allApplications ?? true;
  const created = await one<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role, all_applications)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [b.email.toLowerCase(), b.name, hash, b.role ?? "viewer", allApps]
  );
  await setUserApplications(created!.id, allApps, b.applicationIds ?? []);
  res.status(201).json(await fetchUser(created!.id));
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  ...accessSchema,
});

usersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const hash = b.password ? await bcrypt.hash(b.password, 10) : null;
  const user = await one<{ id: string }>(
    `UPDATE users SET
        name = COALESCE($2, name),
        role = COALESCE($3, role),
        active = COALESCE($4, active),
        password_hash = COALESCE($5, password_hash),
        all_applications = COALESCE($6, all_applications),
        updated_at = now()
      WHERE id = $1 RETURNING id`,
    [req.params.id, b.name ?? null, b.role ?? null, b.active ?? null, hash, b.allApplications ?? null]
  );
  if (!user) return res.status(404).json({ error: "not_found" });
  // Only rewrite assignments when access was part of this update.
  if (b.allApplications !== undefined || b.applicationIds !== undefined) {
    await setUserApplications(user.id, b.allApplications ?? false, b.applicationIds ?? []);
  }
  res.json(await fetchUser(user.id));
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
