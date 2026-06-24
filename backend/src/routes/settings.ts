import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/auth.js";
import { getSmtp, saveSmtp } from "../services/settings.js";
import { sendEmail } from "../services/notify.js";

export const settingsRouter = Router();

// SMTP configuration is admin-only.
settingsRouter.use(requireRole("admin"));

/** GET current SMTP settings (password masked). */
settingsRouter.get("/smtp", async (_req, res) => {
  const s = await getSmtp();
  res.json({
    host: s.host,
    port: s.port,
    user: s.user,
    from: s.from,
    secure: s.secure,
    hasPassword: Boolean(s.pass),
    configured: Boolean(s.host),
  });
});

const smtpSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
  from: z.string().optional(),
  secure: z.boolean().optional(),
});

/** Update SMTP settings. A blank/omitted password keeps the stored one. */
settingsRouter.put("/smtp", async (req, res) => {
  const parsed = smtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = { ...parsed.data };
  if (!b.pass) delete b.pass; // don't overwrite stored password with empty
  await saveSmtp(b);
  const s = await getSmtp();
  res.json({ host: s.host, port: s.port, user: s.user, from: s.from, secure: s.secure, hasPassword: Boolean(s.pass), configured: Boolean(s.host) });
});

/** Send a test email to verify SMTP works. */
settingsRouter.post("/smtp/test", async (req, res) => {
  const to = z.string().email().safeParse(req.body?.to);
  if (!to.success) return res.status(400).json({ error: "valid 'to' email required" });
  try {
    await sendEmail(to.data, {
      title: "SMTP test",
      message: "Your OpsConsole SMTP configuration is working correctly.",
      severity: "info",
    });
    res.json({ sent: true });
  } catch (err: any) {
    res.status(502).json({ sent: false, error: err?.message ?? "send_failed" });
  }
});
