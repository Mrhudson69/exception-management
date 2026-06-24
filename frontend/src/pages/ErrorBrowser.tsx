import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Application, ExceptionDoc } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, SeverityBadge, severityStyles, timeAgo } from "../components/ui";
import { Select } from "../components/Select";

const SEVERITIES = ["critical", "error", "warning", "info"];

export default function ErrorBrowser() {
  const { data: apps } = useFetch<Application[]>("/applications");
  const [urlParams] = useSearchParams();
  const [filters, setFilters] = useState({ q: urlParams.get("q") ?? "", app: "", environment: "all", host: "", userId: "", range: "24h" });
  const [severities, setSeverities] = useState<string[]>([]);
  const [result, setResult] = useState<{ total: number; items: ExceptionDoc[] }>({ total: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ExceptionDoc | null>(null);

  async function search(overrideQ?: string) {
    setLoading(true);
    const q = overrideQ ?? filters.q;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filters.app) params.set("app", filters.app);
    if (filters.environment) params.set("environment", filters.environment);
    if (filters.host) params.set("host", filters.host);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.range) params.set("range", filters.range);
    if (severities.length) params.set("severity", severities.join(","));
    params.set("size", "100");
    try {
      setResult(await api.get(`/exceptions?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }

  // Run on mount, and re-run when a new ?q= arrives from the top-bar search.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const urlQ = urlParams.get("q") ?? "";
    setFilters((f) => ({ ...f, q: urlQ }));
    search(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams.get("q")]);

  function toggleSev(s: string) {
    setSeverities((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="flex flex-col gap-column-gap h-full">
      <PageHeader eyebrow="Exception Management" title="Error Browser">
        <button className="btn-secondary" onClick={() => exportCsv(result.items)}>
          <Icon name="download" size={16} /> Export CSV
        </button>
        <button className="btn-primary" onClick={() => search()}>
          <Icon name="filter_list" size={16} /> Apply Filter
        </button>
      </PageHeader>

      {/* Filter bar */}
      <div className="bg-surface-container-low border border-outline-variant rounded p-gutter shrink-0 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-gutter items-end">
          <Filter label="Search">
            <input className="field font-mono" placeholder="message / type…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && search()} />
          </Filter>
          <Filter label="Time Range">
            <Select value={filters.range} onChange={(v) => setFilters({ ...filters, range: v })}
              options={[
                { value: "15m", label: "Last 15 minutes" },
                { value: "1h", label: "Last 1 hour" },
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
                { value: "all", label: "All time" },
              ]} />
          </Filter>
          <Filter label="Environment">
            <Select value={filters.environment} onChange={(v) => setFilters({ ...filters, environment: v })}
              options={[
                { value: "all", label: "All Environments" },
                { value: "production", label: "Production" },
                { value: "staging", label: "Staging" },
                { value: "development", label: "Development" },
              ]} />
          </Filter>
          <Filter label="Application">
            <Select value={filters.app} onChange={(v) => setFilters({ ...filters, app: v })} placeholder="All Applications"
              options={[{ value: "", label: "All Applications" }, ...(apps ?? []).map((a) => ({ value: a.slug, label: a.name }))]} />
          </Filter>
          <Filter label="Host / Machine">
            <input className="field font-mono" placeholder="e.g. prod-web-04" value={filters.host} onChange={(e) => setFilters({ ...filters, host: e.target.value })} />
          </Filter>
          <Filter label="User / Account ID">
            <input className="field" placeholder="UUID or Email" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} />
          </Filter>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-outline-variant/50">
          <span className="text-label-caps text-on-surface-variant mr-1">Severity:</span>
          {SEVERITIES.map((s) => {
            const active = severities.includes(s);
            const st = severityStyles[s];
            return (
              <button key={s} onClick={() => toggleSev(s)} className={`rounded-full px-2.5 py-0.5 text-[11px] flex items-center gap-1 border transition-colors ${active ? `${st.bg} ${st.text} border-current` : "bg-surface border-outline-variant text-on-surface-variant border-dashed hover:text-on-surface"}`}>
                {active && <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />}
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results table */}
      <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-outline-variant flex justify-between items-center shrink-0">
          <span className="text-body-sm text-on-surface-variant">
            Showing <span className="text-on-surface font-semibold">{result.items.length}</span> of{" "}
            <span className="text-on-surface font-semibold">{result.total.toLocaleString()}</span> errors
          </span>
          {loading && <Icon name="progress_activity" size={16} className="animate-spin text-primary" />}
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead className="sticky top-0 bg-surface-container z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-32">Timestamp</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-24">Severity</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-44">Application</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase">Error Message</th>
                <th className="py-2 px-4 text-label-caps text-on-surface-variant uppercase w-32">Host</th>
              </tr>
            </thead>
            <tbody className="font-mono text-code-md">
              {result.items.map((e) => (
                <tr key={e.id} onClick={() => setSelected(e)} className="border-b border-outline-variant/30 zebra-row hover-row cursor-pointer">
                  <td className="py-2 px-4 text-on-surface-variant whitespace-nowrap" title={new Date(e.timestamp).toLocaleString()}>{timeAgo(e.timestamp)}</td>
                  <td className="py-2 px-4"><SeverityBadge severity={e.severity} /></td>
                  <td className="py-2 px-4 text-primary">{e.app_name}</td>
                  <td className="py-2 px-4 text-on-surface truncate max-w-[360px]">
                    <span className="text-tertiary">{e.exception_type}:</span> {e.message}
                  </td>
                  <td className="py-2 px-4 text-on-surface-variant truncate">{e.host ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !result.items.length && <p className="text-body-sm text-on-surface-variant p-6 text-center">No errors match these filters.</p>}
        </div>
      </div>

      {selected && <DetailDrawer doc={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-caps text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}

function DetailDrawer({ doc, onClose }: { doc: ExceptionDoc; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-surface-container-low border-l border-outline-variant flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1"><SeverityBadge severity={doc.severity} /><span className="text-body-sm text-on-surface-variant">{doc.category}</span></div>
            <h3 className="text-title-sm text-on-surface">{doc.exception_type}</h3>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><Icon name="close" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-label-caps text-on-surface-variant uppercase mb-1">Message</p>
            <p className="text-body-md text-on-surface">{doc.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Meta label="Application" value={doc.app_name} />
            <Meta label="Environment" value={doc.environment} />
            <Meta label="Host" value={doc.host ?? "—"} />
            <Meta label="User" value={doc.user_id ?? "—"} />
            <Meta label="Timestamp" value={new Date(doc.timestamp).toLocaleString()} />
            <Meta label="Fingerprint" value={doc.fingerprint} mono />
          </div>
          <div>
            <p className="text-label-caps text-on-surface-variant uppercase mb-1">Stack Trace</p>
            <pre className="bg-surface-container-lowest border border-outline-variant rounded p-3 text-code-md font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap">{doc.stack_trace || "No stack trace provided."}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-label-caps text-on-surface-variant uppercase mb-0.5">{label}</p>
      <p className={`text-body-sm text-on-surface ${mono ? "font-mono" : ""} break-all`}>{value}</p>
    </div>
  );
}

function exportCsv(items: ExceptionDoc[]) {
  const header = ["timestamp", "severity", "application", "exception_type", "message", "host", "user_id"];
  const rows = items.map((e) => [e.timestamp, e.severity, e.app_name, e.exception_type, `"${e.message.replace(/"/g, '""')}"`, e.host ?? "", e.user_id ?? ""].join(","));
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `exceptions-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
