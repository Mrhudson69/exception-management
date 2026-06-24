import { useState } from "react";
import { api, Application, Threshold } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, Modal, Field, SeverityBadge, EmptyState } from "../components/ui";
import { Select } from "../components/Select";

const metricLabel: Record<string, string> = {
  error_count: "Error Count",
  error_rate: "Error Rate (per min)",
  new_error_type: "New Error Type",
};

export default function Thresholds() {
  const { data: thresholds, refetch } = useFetch<Threshold[]>("/thresholds");
  const { data: apps } = useFetch<Application[]>("/applications");
  const [editing, setEditing] = useState<Threshold | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggle(t: Threshold) {
    await api.patch(`/thresholds/${t.id}`, { enabled: !t.enabled });
    refetch();
  }

  return (
    <div>
      <PageHeader eyebrow="Alert Configuration" title="Thresholds">
        <button className="btn-primary" onClick={() => setCreating(true)}><Icon name="add" size={16} /> Add Rule</button>
      </PageHeader>
      <p className="text-body-sm text-on-surface-variant -mt-4 mb-6">Rules evaluated on every ingested error. A breach raises an alert and notifies the app's routing group.</p>

      {!thresholds?.length ? (
        <div className="glass-panel rounded-xl"><EmptyState icon="speed" text="No threshold rules yet." /></div>
      ) : (
        <div className="space-y-gutter">
          {thresholds.map((t) => (
            <div key={t.id} className="glass-panel rounded-xl p-4 flex items-center gap-4">
              <SeverityBadge severity={t.severity} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body-md text-on-surface font-semibold">{t.name}</span>
                  <span className="text-body-sm text-on-surface-variant">·</span>
                  <span className="text-body-sm text-on-surface-variant">{t.application_name ?? "All Applications (global)"}</span>
                </div>
                <div className="text-body-sm text-on-surface-variant font-mono mt-1">
                  IF <span className="text-primary">{metricLabel[t.metric]}</span> {t.comparator} <span className="text-tertiary">{Number(t.threshold_value)}</span> over {t.window_seconds}s → <span className={severityText(t.severity)}>{t.severity.toUpperCase()}</span>
                </div>
              </div>
              <button onClick={() => toggle(t)} title={t.enabled ? "Enabled" : "Disabled"} className={`relative w-10 h-5 rounded-full transition-colors ${t.enabled ? "bg-primary-container" : "bg-surface-bright"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-on-surface transition-transform ${t.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <button onClick={() => setEditing(t)} className="text-on-surface-variant hover:text-primary"><Icon name="edit" size={18} /></button>
            </div>
          ))}
        </div>
      )}

      {creating && <ThresholdModal apps={apps ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <ThresholdModal threshold={editing} apps={apps ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function severityText(s: string) {
  return { critical: "text-error", error: "text-tertiary", warning: "text-tertiary-fixed-dim", info: "text-primary" }[s] ?? "text-primary";
}

function ThresholdModal({ threshold, apps, onClose, onSaved }: { threshold?: Threshold; apps: Application[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: threshold?.name ?? "",
    applicationId: threshold?.application_id ?? "",
    metric: threshold?.metric ?? "error_count",
    comparator: threshold?.comparator ?? ">",
    thresholdValue: threshold ? Number(threshold.threshold_value) : 50,
    windowSeconds: threshold?.window_seconds ?? 300,
    severity: threshold?.severity ?? "warning",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const body = {
      name: form.name,
      applicationId: form.applicationId || null,
      metric: form.metric,
      comparator: form.comparator,
      thresholdValue: Number(form.thresholdValue),
      windowSeconds: Number(form.windowSeconds),
      severity: form.severity,
    };
    try {
      if (threshold) await api.patch(`/thresholds/${threshold.id}`, body);
      else await api.post("/thresholds", body);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={threshold ? "Edit Threshold" : "New Threshold Rule"} onClose={onClose} wide footer={<>
      {threshold && <button className="btn-secondary text-error mr-auto" onClick={async () => { if (confirm("Delete rule?")) { await api.del(`/thresholds/${threshold.id}`); onSaved(); } }}><Icon name="delete" size={16} /> Delete</button>}
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Rule Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Error burst (>50 / 5m)" autoFocus /></Field>
      <Field label="Scope (Application)">
        <Select value={form.applicationId} onChange={(v) => setForm({ ...form, applicationId: v })} placeholder="All Applications (global)"
          options={[{ value: "", label: "All Applications (global)" }, ...apps.map((a) => ({ value: a.id, label: a.name }))]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Metric">
          <Select value={form.metric} onChange={(v) => setForm({ ...form, metric: v as Threshold["metric"] })}
            options={Object.entries(metricLabel).map(([k, v]) => ({ value: k, label: v }))} />
        </Field>
        <Field label="Severity">
          <Select value={form.severity} onChange={(v) => setForm({ ...form, severity: v as Threshold["severity"] })}
            options={["info", "warning", "error", "critical"].map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Comparator">
          <Select value={form.comparator} onChange={(v) => setForm({ ...form, comparator: v })}
            options={[">", ">=", "<", "<=", "=="].map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label="Value"><input type="number" className="field" value={form.thresholdValue} onChange={(e) => setForm({ ...form, thresholdValue: Number(e.target.value) })} /></Field>
        <Field label="Window (sec)"><input type="number" className="field" value={form.windowSeconds} onChange={(e) => setForm({ ...form, windowSeconds: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  );
}
