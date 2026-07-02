import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one } from "../db/pool.js";
import { requireAuth, signToken, type Role } from "../auth/auth.js";
import { saveSmtp } from "../services/settings.js";

export const authRouter = Router();

async function userCount(): Promise<number> {
  const row = await one<{ c: string }>(`SELECT count(*)::int AS c FROM users`);
  return Number(row?.c ?? 0);
}

/** First-run check: true when no users exist yet (show the setup wizard). */
authRouter.get("/setup-status", async (_req, res) => {
  res.json({ needsSetup: (await userCount()) === 0 });
});

const setupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  smtp: z
    .object({
      host: z.string().optional(),
      port: z.number().int().positive().optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
      from: z.string().optional(),
      secure: z.boolean().optional(),
    })
    .optional(),
});

/**
 * First-run setup: create the initial admin (and optionally SMTP). Only works
 * while the system has zero users, so it can't be abused after onboarding.
 */
authRouter.post("/setup", async (req, res) => {
  if ((await userCount()) > 0) return res.status(409).json({ error: "already_initialized" });
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;

  const hash = await bcrypt.hash(b.password, 10);
  const user = await one<{ id: string; email: string; name: string; role: Role }>(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'admin')
     RETURNING id, email, name, role`,
    [b.email.toLowerCase(), b.name, hash]
  );

  if (b.smtp && b.smtp.host) {
    await saveSmtp(b.smtp);
  }

  const principal = { id: user!.id, email: user!.email, name: user!.name, role: user!.role };
  res.status(201).json({ token: signToken(principal), user: principal });
});

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  active: boolean;
  all_applications: boolean;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });
  const { email, password } = parsed.data;

  const user = await one<UserRow>(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (!user || !user.active) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  await one(`UPDATE users SET last_login_at = now() WHERE id = $1 RETURNING id`, [user.id]);

  const principal = { id: user.id, email: user.email, name: user.name, role: user.role };
  res.json({ token: signToken(principal), user: { ...principal, all_applications: user.all_applications } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const row = await one<{ all_applications: boolean }>(
    `SELECT all_applications FROM users WHERE id = $1`,
    [req.user!.id]
  );
  res.json({ user: { ...req.user, all_applications: row?.all_applications ?? true } });
});
