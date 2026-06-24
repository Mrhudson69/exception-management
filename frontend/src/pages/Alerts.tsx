import { useState } from "react";
import { api, Alert } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, SeverityBadge, EmptyState, timeAgo } from "../components/ui";

const tabs = [
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "", label: "All" },
];

export default function Alerts() {
  const [status, setStatus] = useState("open");
  const { data: alerts, refetch, loading } = useFetch<Alert[]>(`/alerts${status ? `?status=${status}` : ""}`, [status]);

  async function act(id: string, action: "acknowledge" | "resolve") {
    await api.post(`/alerts/${id}/${action}`);
    refetch();
  }

  return (
    <div>
      <PageHeader eyebrow="Incident Response" title="Alerts" />

      <div className="flex items-center gap-1 mb-4 bg-surface-container border border-outline-variant rounded-full p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setStatus(t.key)} className={`px-4 py-1 text-body-sm rounded-full transition-colors ${status === t.key ? "bg-surface-bright text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-on-surface-variant"><Icon name="progress_activity" className="animate-spin" /></div>
        ) : !alerts?.length ? (
          <EmptyState icon="check_circle" text="No alerts in this state. All clear." />
        ) : (
          <table className="w-full text-left min-w-[680px]">
            <thead className="border-b border-outline-variant">
              <tr>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-24">Severity</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase">Alert</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-28 text-center">Events</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-28">Triggered</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-48 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-outline-variant/30 hover-row">
                  <td className="py-3 px-4"><SeverityBadge severity={a.severity} /></td>
                  <td className="py-3 px-4">
                    <div className="text-body-md text-on-surface font-semibold">{a.title}</div>
                    <div className="text-body-sm text-on-surface-variant">{a.message}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-code-md text-on-surface">{a.event_count}</td>
                  <td className="py-3 px-4 text-body-sm text-on-surface-variant whitespace-nowrap" title={new Date(a.triggered_at).toLocaleString()}>{timeAgo(a.triggered_at)}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      {a.status === "open" && (
                        <button onClick={() => act(a.id, "acknowledge")} className="btn-secondary !py-1 text-body-sm">
                          <Icon name="visibility" size={14} /> Ack
                        </button>
                      )}
                      {a.status !== "resolved" && (
                        <button onClick={() => act(a.id, "resolve")} className="btn-primary !py-1 text-body-sm">
                          <Icon name="check" size={14} /> Resolve
                        </button>
                      )}
                      {a.status === "resolved" && <span className="text-body-sm text-primary flex items-center gap-1"><Icon name="check_circle" size={16} /> Resolved</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
