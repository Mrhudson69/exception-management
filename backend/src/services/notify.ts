import nodemailer from "nodemailer";
import { config } from "../config.js";
import { rows } from "../db/pool.js";
import { getMailerVersion, getSmtp } from "./settings.js";

export interface NotificationPayload {
  title: string;
  message: string;
  severity: string;
  appName?: string;
  url?: string;
}

export interface ChannelRow {
  id: string;
  name: string;
  type: "email" | "slack" | "teams" | "webhook";
  config: Record<string, any>;
}

let mailer: nodemailer.Transporter | null = null;
let mailerFrom = config.smtp.from;
let builtVersion = -1;

/** Build (or rebuild) the SMTP transport from current DB/env settings. */
async function getMailer(): Promise<nodemailer.Transporter | null> {
  const version = getMailerVersion();
  if (mailer && version === builtVersion) return mailer;
  const smtp = await getSmtp();
  mailerFrom = smtp.from;
  if (!smtp.host) {
    mailer = null;
  } else {
    mailer = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
  }
  builtVersion = version;
  return mailer;
}

const severityColor: Record<string, string> = {
  info: "#4d8eff",
  warning: "#df7412",
  error: "#ffb786",
  critical: "#93000a",
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }
}

async function sendSlack(url: string, p: NotificationPayload) {
  await postJson(url, {
    attachments: [
      {
        color: severityColor[p.severity] ?? "#4d8eff",
        title: `[${p.severity.toUpperCase()}] ${p.title}`,
        text: p.message,
        fields: p.appName ? [{ title: "Application", value: p.appName, short: true }] : [],
      },
    ],
  });
}

async function sendTeams(url: string, p: NotificationPayload) {
  await postJson(url, {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: (severityColor[p.severity] ?? "#4d8eff").replace("#", ""),
    summary: p.title,
    title: `[${p.severity.toUpperCase()}] ${p.title}`,
    text: `${p.message}${p.appName ? `\n\n**Application:** ${p.appName}` : ""}`,
  });
}

async function sendWebhook(url: string, p: NotificationPayload) {
  await postJson(url, p);
}

export async function sendEmail(to: string, p: NotificationPayload) {
  const transport = await getMailer();
  const html = `<h2>[${p.severity.toUpperCase()}] ${p.title}</h2><p>${p.message}</p>${
    p.appName ? `<p><b>Application:</b> ${p.appName}</p>` : ""
  }`;
  if (!transport) {
    throw new Error("SMTP is not configured");
  }
  await transport.sendMail({
    from: mailerFrom,
    to,
    subject: `[${p.severity.toUpperCase()}] ${p.title}`,
    html,
  });
}

/**
 * Actually deliver to a single channel. Throws on transport failure.
 * Used directly by the "send test" endpoint so callers can report the result.
 */
export async function deliverToChannel(channel: ChannelRow, p: NotificationPayload): Promise<void> {
  switch (channel.type) {
    case "slack":
      if (!channel.config.webhookUrl) throw new Error("Slack channel has no webhookUrl configured");
      return sendSlack(channel.config.webhookUrl, p);
    case "teams":
      if (!channel.config.webhookUrl) throw new Error("Teams channel has no webhookUrl configured");
      return sendTeams(channel.config.webhookUrl, p);
    case "webhook":
      if (!channel.config.url) throw new Error("Webhook channel has no url configured");
      return sendWebhook(channel.config.url, p);
    case "email":
      if (!channel.config.to) throw new Error("Email channel has no recipient configured");
      return sendEmail(channel.config.to, p);
  }
}

/**
 * Fan-out dispatch used by the alert/escalation engine. Honours the global
 * NOTIFICATIONS_LIVE flag (dry-run logs when off) and never throws.
 */
export async function dispatchToChannel(channel: ChannelRow, p: NotificationPayload, force = false): Promise<void> {
  if (!config.notificationsLive && !force) {
    console.log(`[notify dry-run] ${channel.type}:${channel.name} :: ${p.title}`);
    return;
  }
  try {
    await deliverToChannel(channel, p);
  } catch (err) {
    console.error(`[notify] failed dispatching to ${channel.type}:${channel.name}`, err);
  }
}

/** Send a notification to every channel + email in the given notification group. */
export async function notifyGroup(groupId: string | null, p: NotificationPayload) {
  if (!groupId) return;
  const channels = await rows<ChannelRow>(
    `SELECT c.id, c.name, c.type, c.config
       FROM notification_channels c
       JOIN notification_group_channels gc ON gc.channel_id = c.id
      WHERE gc.group_id = $1 AND c.enabled = true`,
    [groupId]
  );
  const group = await rows<{ emails: string[] }>(
    `SELECT emails FROM notification_groups WHERE id = $1`,
    [groupId]
  );
  await Promise.all(channels.map((c) => dispatchToChannel(c, p)));
  const emails = group[0]?.emails ?? [];
  if (config.notificationsLive) {
    await Promise.all(emails.map((e) => sendEmail(e, p).catch((err) => console.error("[notify:email]", err))));
  } else if (emails.length) {
    console.log(`[notify dry-run] email -> ${emails.join(", ")} :: ${p.title}`);
  }
}
