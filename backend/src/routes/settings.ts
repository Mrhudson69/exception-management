import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/auth.js";
import { getSmtp, saveSmtp, getBranding, saveBranding } from "../services/settings.js";
import { sendEmail } from "../services/notify.js";
import { validateLogo } from "../services/logo.js";

export const settingsRouter = Router();

// These settings endpoints are admin-only.
settingsRouter.use(requireRole("admin"));

const brandingSchema = z.object({
  appName: z.string().min(1).max(40).optional(),
  productName: z.string().min(1).max(40).optional(),
  tagline: z.string().max(80).optional(),
  logo: z.string().nullable().optional(), // data URL, or null to remove, or omit to keep
});

/** Update branding (names/tagline and an optional validated logo). */
settingsRouter.put("/branding", async (req, res) => {
  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = { ...parsed.data };

  if (typeof b.logo === "string" && b.logo.length > 0) {
    const result = validateLogo(b.logo);
    if (!result.ok) return res.status(400).json({ error: result.error });
    b.logo = result.value;
  }
  res.json(await saveBranding(b));
});

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
