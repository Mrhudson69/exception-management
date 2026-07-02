import { Router } from "express";
import { es, EXCEPTIONS_INDEX } from "../es/client.js";
import { getAppScope } from "../auth/scope.js";

export const exceptionsRouter = Router();

/** GET /api/exceptions — search & filter exceptions stored in Elasticsearch. */
exceptionsRouter.get("/", async (req, res) => {
  const {
    q,
    app,
    environment,
    severity,
    category,
    host,
    userId,
    range = "24h",
    from = "0",
    size = "50",
  } = req.query as Record<string, string>;

  const filter: any[] = [];
  // Limit results to the applications this user is allowed to see.
  const scope = await getAppScope(req.user!);
  if (!scope.all) filter.push({ terms: { app_slug: scope.slugs } });
  if (app) filter.push({ term: { app_slug: app } });
  if (environment && environment !== "all") filter.push({ term: { environment } });
  if (host) filter.push({ term: { host } });
  if (userId) filter.push({ term: { user_id: userId } });
  if (category) filter.push({ term: { category } });
  if (severity) {
    const sevs = severity.split(",").filter(Boolean);
    if (sevs.length) filter.push({ terms: { severity: sevs } });
  }
  if (range && range !== "all") {
    filter.push({ range: { timestamp: { gte: `now-${range}` } } });
  }

  const must: any[] = [];
  if (q) {
    must.push({
      multi_match: {
        query: q,
        fields: ["message^2", "exception_type^2", "stack_trace", "host", "app_name"],
      },
    });
  }

  try {
    const result = await es.search({
      index: EXCEPTIONS_INDEX,
      from: Number(from),
      size: Math.min(Number(size), 200),
      sort: [{ timestamp: { order: "desc" } }],
      query: { bool: { must: must.length ? must : [{ match_all: {} }], filter } },
    });

    const total =
      typeof result.hits.total === "number"
        ? result.hits.total
        : result.hits.total?.value ?? 0;

    res.json({
      total,
      items: result.hits.hits.map((h: any) => ({ id: h._id, ...h._source })),
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return res.json({ total: 0, items: [] });
    throw err;
  }
});

/** GET /api/exceptions/:id — single exception document. */
exceptionsRouter.get("/:id", async (req, res) => {
  try {
    const doc = await es.get({ index: EXCEPTIONS_INDEX, id: req.params.id });
    const source = doc._source as { app_slug?: string };
    const scope = await getAppScope(req.user!);
    // Don't leak a document for an application the user isn't allowed to see.
    if (!scope.all && !scope.slugs.includes(source.app_slug ?? "")) {
      return res.status(404).json({ error: "not_found" });
    }
    res.json({ id: doc._id, ...(doc._source as object) });
  } catch {
    res.status(404).json({ error: "not_found" });
  }
});
