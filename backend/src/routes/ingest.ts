import { Router } from "express";
import { z } from "zod";
import { es, EXCEPTIONS_INDEX } from "../es/client.js";
import { one } from "../db/pool.js";
import { fingerprint, inferCategory, inferSeverity } from "../services/categorize.js";
import { evaluateThresholds } from "../services/alertEngine.js";

export const ingestRouter = Router();

const ingestSchema = z.object({
  // Application identity: by slug (preferred) or name. The X-Api-Key header is
  // matched against applications.ingest_key when present.
  app: z.string().optional(),
  appSlug: z.string().optional(),
  exceptionType: z.string().optional(),
  type: z.string().optional(),
  message: z.string().min(1, "message is required"),
  stackTrace: z.string().optional(),
  stack: z.string().optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  environment: z.string().optional(),
  host: z.string().optional(),
  userId: z.string().optional(),
  release: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  tags: z.record(z.any()).optional(),
});

interface AppRow {
  id: string;
  name: string;
  slug: string;
  environment: string;
  notification_group_id: string | null;
  status: string;
}

async function resolveApplication(
  apiKey: string | undefined,
  slugOrName: string | undefined
): Promise<AppRow | null> {
  if (apiKey) {
    const byKey = await one<AppRow>(
      `SELECT id, name, slug, environment, notification_group_id, status
         FROM applications WHERE ingest_key = $1`,
      [apiKey]
    );
    if (byKey) return byKey;
  }
  if (slugOrName) {
    return one<AppRow>(
      `SELECT id, name, slug, environment, notification_group_id, status
         FROM applications WHERE slug = $1 OR name = $1`,
      [slugOrName]
    );
  }
  return null;
}

ingestRouter.post("/", async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  const body = parsed.data;

  const apiKey = (req.header("x-api-key") ?? req.header("X-Api-Key") ?? undefined) as
    | string
    | undefined;
  const slugOrName = body.appSlug ?? body.app;

  let app = await resolveApplication(apiKey, slugOrName);

  // Auto-register unknown applications so no error is ever dropped.
  if (!app) {
    if (!slugOrName) {
      return res.status(400).json({ error: "unidentified_application", hint: "Provide 'app'/'appSlug' or a valid X-Api-Key." });
    }
    const slug = slugOrName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    app = await one<AppRow>(
      `INSERT INTO applications (name, slug, ingest_key, environment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET updated_at = now()
       RETURNING id, name, slug, environment, notification_group_id, status`,
      [slugOrName, slug, `auto_${slug}_${Math.random().toString(36).slice(2, 10)}`, body.environment ?? "production"]
    );
  }
  if (!app) return res.status(500).json({ error: "application_resolution_failed" });
  if (app.status === "suspended") {
    return res.status(202).json({ status: "suppressed", reason: "application_suspended" });
  }

  const exceptionType = body.exceptionType ?? body.type ?? "Error";
  const stackTrace = body.stackTrace ?? body.stack ?? "";
  const severity = inferSeverity(body.severity, exceptionType, body.message);
  const category = inferCategory(exceptionType, body.message);
  const fp = fingerprint(app.slug, exceptionType, body.message);
  const now = new Date().toISOString();

  // Has this fingerprint been seen before? (used by new_error_type thresholds)
  const prior = await es.count({
    index: EXCEPTIONS_INDEX,
    query: { term: { fingerprint: fp } },
  });
  const isNewType = prior.count === 0;

  const doc = {
    app_id: app.id,
    app_slug: app.slug,
    app_name: app.name,
    environment: body.environment ?? app.environment,
    severity,
    category,
    exception_type: exceptionType,
    message: body.message,
    stack_trace: stackTrace,
    fingerprint: fp,
    host: body.host ?? null,
    user_id: body.userId ?? null,
    release: body.release ?? null,
    tags: body.tags ?? {},
    timestamp: body.timestamp ?? now,
    received_at: now,
  };

  const result = await es.index({ index: EXCEPTIONS_INDEX, document: doc, refresh: false });

  // Evaluate alert thresholds (fire-and-forget so ingest stays fast).
  evaluateThresholds(
    { id: app.id, name: app.name, slug: app.slug, notification_group_id: app.notification_group_id },
    { fingerprint: fp, isNewType, severity }
  ).catch((err) => console.error("[alertEngine]", err));

  return res.status(201).json({
    status: "accepted",
    id: result._id,
    application: app.slug,
    severity,
    category,
    fingerprint: fp,
  });
});
