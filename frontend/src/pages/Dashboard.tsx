import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardData } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, Panel, SeverityBadge, timeAgo } from "../components/ui";

const ranges = ["1h", "24h", "7d"] as const;

function Kpi({ label, value, icon, accent, hint, hintClass }: { label: string; value: string | number; icon: string; accent?: string; hint?: string; hintClass?: string }) {
  return (
    <div className={`glass-panel p-4 rounded-xl flex flex-col justify-between h-[120px] ${accent ?? ""}`}>
      <div className="flex justify-between items-start">
        <span className="text-title-sm text-on-surface-variant">{label}</span>
        <Icon name={icon} size={18} className="text-outline" />
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-display-lg ${accent ? "text-error" : "text-on-surface"}`}>{value}</span>
        {hint && <span className={`text-body-sm ${hintClass ?? "text-on-surface-variant"}`}>{hint}</span>}
      </div>
    </div>
  );
}

const REFRESH_MS = 5000;

export default function Dashboard() {
  const [range, setRange] = useState<(typeof ranges)[number]>("24h");
  const [live, setLive] = useState(true);
  const { data, loading } = useFetch<DashboardData>(`/dashboard?range=${range}`, [range], {
    pollMs: live ? REFRESH_MS : 0,
  });

  const k = data?.kpis;
  const maxApp = Math.max(1, ...(data?.topApps.map((a) => a.count) ?? [1]));

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-headline-md text-on-surface mb-1">Exception Management Center</h2>
          <p className="text-body-sm text-on-surface-variant">Real-time telemetry and error monitoring across all clusters.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          onClick={() => setLive((v) => !v)}
          title={live ? `Auto-refresh on — every ${REFRESH_MS / 1000}s` : "Auto-refresh paused"}
          className="bg-surface-container border border-outline-variant rounded-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-outline"}`} />
          {live ? "Live" : "Paused"}
        </button>
        <div className="bg-surface-container border border-outline-variant rounded-full flex items-center p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-body-sm rounded-full transition-colors ${
                range === r ? "bg-surface-bright text-on-surface" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
        <Kpi label="Total Errors" value={(k?.totalErrors ?? 0).toLocaleString()} icon="analytics" hint={loading ? "…" : range.toUpperCase()} />
        <Kpi label="Critical Exceptions" value={(k?.criticalExceptions ?? 0).toLocaleString()} icon="warning" accent="border-l-4 border-l-error" hint="needs triage" hintClass="text-error font-bold" />
        <Kpi label="Active Apps" value={k?.activeApps ?? 0} icon="apps" hint="monitored" hintClass="text-primary" />
        <Kpi label="Active Alerts" value={k?.activeAlerts ?? 0} icon="notifications_active" hint="open" hintClass="text-tertiary" />
      </div>

      {/* Trend + top apps */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-gutter">
        <Panel className="lg:col-span-8 h-[320px]" title={<><Icon name="timeline" size={16} className="text-on-surface-variant" /> Error Frequency Trends</>}>
          <div className="flex-1 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend ?? []} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4d8eff" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#171f33" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "#171f33", border: "1px solid #424754", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#c2c6d6" }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                />
                <Area type="monotone" dataKey="count" stroke="#adc6ff" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="lg:col-span-4 h-[320px]" title="Top Applications" action={<span className="text-label-caps text-on-surface-variant uppercase">By Error Count</span>}>
          <div className="flex-1 p-2 overflow-y-auto">
            {(data?.topApps ?? []).map((a, i) => {
              const color = i === 0 ? "bg-error" : i === 1 ? "bg-tertiary" : "bg-primary";
              const txt = i === 0 ? "text-error" : i === 1 ? "text-tertiary" : "text-primary";
              return (
                <div key={a.app} className="px-3 py-2 hover:bg-surface-container-highest rounded transition-colors mb-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-body-md text-on-surface font-semibold">{a.app}</span>
                    <span className={`font-mono text-code-md ${txt}`}>{a.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-surface-bright rounded-full h-1.5">
                    <div className={`${color} h-1.5 rounded-full`} style={{ width: `${(a.count / maxApp) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {!loading && !data?.topApps.length && <p className="text-body-sm text-on-surface-variant p-3">No data yet.</p>}
          </div>
        </Panel>
      </div>

      {/* Recent exceptions */}
      <Panel className="h-[400px]" title="Recent Exceptions" action={<span className="text-label-caps text-on-surface-variant uppercase">Live feed</span>}>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead className="sticky top-0 bg-surface-container z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-28">Time</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-48">Application</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase">Message Snippet</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-20 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="font-mono text-code-md">
              {(data?.recent ?? []).map((e) => (
                <tr key={e.id} className="border-b border-outline-variant/30 hover-row group">
                  <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{timeAgo(e.timestamp)}</td>
                  <td className="py-2.5 px-4 text-primary group-hover:underline">{e.app_name}</td>
                  <td className="py-2.5 px-4 text-on-surface truncate max-w-[300px]">
                    <span className="bg-error/20 text-error px-1 rounded mr-2">{e.exception_type}</span>
                    {e.message}
                  </td>
                  <td className="py-2.5 px-4 text-center"><SeverityBadge severity={e.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !data?.recent.length && <p className="text-body-sm text-on-surface-variant p-4">No exceptions ingested yet. POST to /ingest to get started.</p>}
        </div>
      </Panel>
    </div>
  );
}
