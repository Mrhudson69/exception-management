import { one } from "../db/pool.js";
import { config } from "../config.js";

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

/** Effective SMTP config: DB-stored values override env defaults. */
export async function getSmtp(): Promise<SmtpSettings> {
  const row = await one<{ value: Record<string, any> }>(
    `SELECT value FROM app_settings WHERE key = 'smtp'`
  );
  const v = row?.value ?? {};
  const port = Number(v.port ?? config.smtp.port);
  return {
    host: v.host ?? config.smtp.host,
    port,
    user: v.user ?? config.smtp.user,
    pass: v.pass ?? config.smtp.pass,
    from: v.from ?? config.smtp.from,
    secure: typeof v.secure === "boolean" ? v.secure : port === 465,
  };
}

/** Persist SMTP settings (merging over what's stored). Invalidates the mailer. */
export async function saveSmtp(partial: Partial<SmtpSettings>): Promise<void> {
  const current = await one<{ value: Record<string, any> }>(
    `SELECT value FROM app_settings WHERE key = 'smtp'`
  );
  const merged = { ...(current?.value ?? {}), ...partial };
  await one(
    `INSERT INTO app_settings (key, value) VALUES ('smtp', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now() RETURNING key`,
    [JSON.stringify(merged)]
  );
  invalidateMailer();
}

// Mailer invalidation signal consumed by notify.ts.
let mailerVersion = 0;
export function invalidateMailer() {
  mailerVersion++;
}
export function getMailerVersion() {
  return mailerVersion;
}
