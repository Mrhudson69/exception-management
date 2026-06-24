import { useState } from "react";
import { api, EscalationRule, NotificationGroup, Threshold } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, Modal, Field, EmptyState } from "../components/ui";
import { Select } from "../components/Select";

function fmtDelay(s: number) {
  if (s === 0) return "Immediately";
  if (s < 60) return `After ${s}s`;
  if (s < 3600) return `After ${Math.round(s / 60)}m`;
  return `After ${Math.round(s / 3600)}h`;
}

export default function Escalations() {
  const { data: rules, refetch } = useFetch<EscalationRule[]>("/escalations");
  const { data: thresholds } = useFetch<Threshold[]>("/thresholds");
  const { data: groups } = useFetch<NotificationGroup[]>("/notification-groups");
  const [editing, setEditing] = useState<EscalationRule | null>(null);
  const [creating, setCreating] = useState(false);

  // Group rules by threshold to render policies as ordered chains.
  const byThreshold = new Map<string, EscalationRule[]>();
  for (const r of rules ?? []) {
    const key = r.threshold_name ?? "Unassigned";
    if (!byThreshold.has(key)) byThreshold.set(key, []);
    byThreshold.get(key)!.push(r);
  }

  return (
    <div>
      <PageHeader eyebrow="Alert Configuration" title="Escalation Policies">
        <button className="btn-primary" onClick={() => setCreating(true)}><Icon name="add" size={16} /> Add Step</button>
      </PageHeader>
      <p className="text-body-sm text-on-surface-variant -mt-4 mb-6">Ordered steps that fire when an alert stays unacknowledged. Each step notifies a group after its delay.</p>

      {!rules?.length ? (
        <div className="glass-panel rounded-xl"><EmptyState icon="trending_up" text="No escalation steps configured." /></div>
      ) : (
        <div className="space-y-6">
          {[...byThreshold.entries()].map(([threshold, steps]) => (
            <div key={threshold} className="glass-panel rounded-xl p-4">
              <h3 className="text-title-sm text-on-surface mb-4 flex items-center gap-2"><Icon name="policy" size={18} className="text-primary" /> {threshold}</h3>
              <div className="space-y-3">
                {steps.sort((a, b) => a.step_order - b.step_order).map((r, i) => (
                  <div key={r.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-secondary-container/40 border border-outline-variant flex items-center justify-center text-body-sm text-primary font-bold">{r.step_order}</div>
                      {i < steps.length - 1 && <div className="w-px flex-1 bg-outline-variant my-1 min-h-[16px]" />}
                    </div>
                    <div className="flex-1 bg-surface-container border border-outline-variant rounded p-3 flex items-center justify-between">
                      <div>
                        <div className="text-body-md text-on-surface font-semibold">{r.name}</div>
                        <div className="text-body-sm text-on-surface-variant">{fmtDelay(r.after_seconds)} → notify <span className="text-primary">{r.notification_group_name ?? "—"}</span></div>
                        {r.message && <div className="text-body-sm text-on-surface-variant italic mt-1">"{r.message}"</div>}
                      </div>
                      <button onClick={() => setEditing(r)} className="text-on-surface-variant hover:text-primary"><Icon name="edit" size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <EscalationModal thresholds={thresholds ?? []} groups={groups ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <EscalationModal rule={editing} thresholds={thresholds ?? []} groups={groups ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function EscalationModal({ rule, thresholds, groups, onClose, onSaved }: { rule?: EscalationRule; thresholds: Threshold[]; groups: NotificationGroup[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: rule?.name ?? "",
    thresholdId: rule?.threshold_id ?? "",
    stepOrder: rule?.step_order ?? 1,
    afterSeconds: rule?.after_seconds ?? 0,
    notificationGroupId: rule?.notification_group_id ?? "",
    message: rule?.message ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const body = {
      name: form.name,
      thresholdId: form.thresholdId || null,
      stepOrder: Number(form.stepOrder),
      afterSeconds: Number(form.afterSeconds),
      notificationGroupId: form.notificationGroupId || null,
      message: form.message,
    };
    try {
      if (rule) await api.patch(`/escalations/${rule.id}`, body);
      else await api.post("/escalations", body);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={rule ? "Edit Step" : "New Escalation Step"} onClose={onClose} wide footer={<>
      {rule && <button className="btn-secondary text-error mr-auto" onClick={async () => { if (confirm("Delete step?")) { await api.del(`/escalations/${rule.id}`); onSaved(); } }}><Icon name="delete" size={16} /> Delete</button>}
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Step Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Escalate to engineering leads" autoFocus /></Field>
      <Field label="Threshold">
        <Select value={form.thresholdId} onChange={(v) => setForm({ ...form, thresholdId: v })} placeholder="Unassigned"
          options={[{ value: "", label: "Unassigned" }, ...thresholds.map((t) => ({ value: t.id, label: t.name }))]} />
      </Field>
      <Field label="Notify Group">
        <Select value={form.notificationGroupId} onChange={(v) => setForm({ ...form, notificationGroupId: v })} placeholder="Select group…"
          options={[{ value: "", label: "Select group…" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Step Order"><input type="number" className="field" value={form.stepOrder} onChange={(e) => setForm({ ...form, stepOrder: Number(e.target.value) })} /></Field>
        <Field label="Delay (seconds)"><input type="number" className="field" value={form.afterSeconds} onChange={(e) => setForm({ ...form, afterSeconds: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Message (optional)"><textarea className="field" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
    </Modal>
  );
}
