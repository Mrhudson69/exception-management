import { Router } from "express";
import { es, EXCEPTIONS_INDEX } from "../es/client.js";
import { rows } from "../db/pool.js";
import { getAppScope } from "../auth/scope.js";

export const dashboardRouter = Router();

/** GET /api/dashboard?range=24h — KPI cards, trend series, top apps, recent feed. */
dashboardRouter.get("/", async (req, res) => {
  const range = (req.query.range as string) || "24h";
  const interval = range === "1h" ? "5m" : range === "7d" ? "6h" : "1h";

  // Restrict everything to the applications this user is allowed to see.
  const scope = await getAppScope(req.user!);
  const appFilter = scope.all ? [] : [{ terms: { app_slug: scope.slugs } }];
  const baseFilter = [...appFilter, { range: { timestamp: { gte: `now-${range}` } } }];
  // Postgres-side app filter (alerts/applications) for restricted users.
  const alertsWhere = scope.all ? "" : ` AND application_id = ANY($1)`;
  const appsWhere = scope.all ? "" : ` AND id = ANY($1)`;
  const pgParams = scope.all ? [] : [scope.ids];

  try {
    const [totals, byApp, trend, recent, activeAlerts, appCount] = await Promise.all([
      es.search({
        index: EXCEPTIONS_INDEX,
        size: 0,
        query: { bool: { filter: baseFilter } },
        aggs: { by_severity: { terms: { field: "severity", size: 10 } } },
      }),
      es.search({
        index: EXCEPTIONS_INDEX,
        size: 0,
        query: { bool: { filter: baseFilter } },
        aggs: { apps: { terms: { field: "app_name", size: 6, order: { _count: "desc" } } } },
      }),
      es.search({
        index: EXCEPTIONS_INDEX,
        size: 0,
        query: { bool: { filter: baseFilter } },
        aggs: {
          over_time: {
            date_histogram: { field: "timestamp", fixed_interval: interval, min_doc_count: 0 },
          },
        },
      }),
      es.search({
        index: EXCEPTIONS_INDEX,
        size: 8,
        sort: [{ timestamp: { order: "desc" } }],
        query: { bool: { filter: appFilter } },
      }),
      rows<{ c: string }>(`SELECT count(*)::int AS c FROM alerts WHERE status = 'open'${alertsWhere}`, pgParams),
      rows<{ c: string }>(`SELECT count(*)::int AS c FROM applications WHERE status <> 'suspended'${appsWhere}`, pgParams),
    ]);

    const totalHits =
      typeof totals.hits.total === "number" ? totals.hits.total : totals.hits.total?.value ?? 0;
    const sevBuckets = (totals.aggregations?.by_severity as any)?.buckets ?? [];
    const critical = sevBuckets.find((b: any) => b.key === "critical")?.doc_count ?? 0;

    res.json({
      kpis: {
        totalErrors: totalHits,
        criticalExceptions: critical,
        activeApps: Number(appCount[0]?.c ?? 0),
        activeAlerts: Number(activeAlerts[0]?.c ?? 0),
        severityBreakdown: sevBuckets.map((b: any) => ({ severity: b.key, count: b.doc_count })),
      },
      trend: ((trend.aggregations?.over_time as any)?.buckets ?? []).map((b: any) => ({
        time: b.key_as_string,
        count: b.doc_count,
      })),
      topApps: ((byApp.aggregations?.apps as any)?.buckets ?? []).map((b: any) => ({
        app: b.key,
        count: b.doc_count,
      })),
      recent: recent.hits.hits.map((h: any) => ({ id: h._id, ...h._source })),
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) {
      return res.json({
        kpis: { totalErrors: 0, criticalExceptions: 0, activeApps: 0, activeAlerts: 0, severityBreakdown: [] },
        trend: [],
        topApps: [],
        recent: [],
      });
    }
    throw err;
  }
});
