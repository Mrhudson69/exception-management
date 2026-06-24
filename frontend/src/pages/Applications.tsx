import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Application, NotificationGroup, Team } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../auth/AuthContext";
import { Icon, PageHeader, StatusBadge, Modal, Field } from "../components/ui";
import { Select } from "../components/Select";

export default function Applications() {
  const { can } = useAuth();
  const { data: apps, refetch } = useFetch<Application[]>("/applications");
  const { data: teams } = useFetch<Team[]>("/teams");
  const { data: groups } = useFetch<NotificationGroup[]>("/notification-groups");
  const [selected, setSelected] = useState<Application | null>(null);
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();

  // The sidebar "New Project" button navigates here with ?new=1.
  useEffect(() => {
    if (params.get("new") === "1") {
      setCreating(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Keep selection in sync with refetched data.
  useEffect(() => {
    if (selected) setSelected(apps?.find((a) => a.id === selected.id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps]);

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Applications">
        {can("editor") && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Icon name="add" size={16} /> Register App
          </button>
        )}
      </PageHeader>
      <p className="text-body-sm text-on-surface-variant -mt-4 mb-6">Manage registered services, view health, and configure ownership & routing.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Service list */}
        <div className="lg:col-span-2 glass-panel rounded-xl overflow-x-auto">
          <table className="w-full text-left min-w-[480px]">
            <thead className="border-b border-outline-variant">
              <tr>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase">Service</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-32">Status</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-28 text-right">Errors (24h)</th>
              </tr>
            </thead>
            <tbody>
              {apps?.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`border-b border-outline-variant/30 hover-row cursor-pointer ${selected?.id === a.id ? "bg-secondary-container/20" : ""}`}
                >
                  <td className="py-3 px-4">
                    <div className="text-body-md text-on-surface font-semibold flex items-center gap-2">
                      {selected?.id === a.id && <span className="w-1 h-4 bg-primary rounded-full" />}
                      {a.name}
                    </div>
                    <div className="text-body-sm text-on-surface-variant font-mono">{a.slug} · {a.owning_team_name ?? "Unassigned"}</div>
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                  <td className="py-3 px-4 text-right font-mono text-code-md text-on-surface">{(a.errors24h ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {!apps?.length && <tr><td colSpan={3} className="p-6 text-center text-body-sm text-on-surface-variant">No applications registered yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Responsibility panel */}
        <div className="glass-panel rounded-xl p-4">
          {selected ? (
            <ResponsibilityPanel key={selected.id} app={selected} teams={teams ?? []} groups={groups ?? []} onSaved={refetch} onDeleted={() => { setSelected(null); refetch(); }} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 py-10">
              <Icon name="touch_app" size={32} className="text-outline" />
              <p className="text-body-sm">Select a service to configure ownership & routing.</p>
            </div>
          )}
        </div>
      </div>

      {creating && <CreateAppModal teams={teams ?? []} groups={groups ?? []} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refetch(); }} />}
    </div>
  );
}

function ResponsibilityPanel({ app, teams, groups, onSaved, onDeleted }: { app: Application; teams: Team[]; groups: NotificationGroup[]; onSaved: () => void; onDeleted: () => void }) {
  const [teamId, setTeamId] = useState(app.owning_team_id ?? "");
  const [groupId, setGroupId] = useState(app.notification_group_id ?? "");
  const [status, setStatus] = useState(app.status);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/applications/${app.id}`, {
        owningTeamId: teamId || null,
        notificationGroupId: groupId || null,
        status,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-title-sm text-on-surface">{app.name}</h3>
          <p className="text-body-sm text-on-surface-variant font-mono">{app.environment}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <p className="text-label-caps text-on-surface-variant uppercase mb-2">Responsibility Mapping</p>
      <div className="space-y-3">
        <Field label="Owning Team">
          <Select value={teamId} onChange={setTeamId} placeholder="Unassigned"
            options={[{ value: "", label: "Unassigned" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
        </Field>
        <Field label="Notification Routing">
          <Select value={groupId} onChange={setGroupId} placeholder="No routing"
            options={[{ value: "", label: "No routing" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(v) => setStatus(v as Application["status"])}
            options={["healthy", "warning", "degraded", "critical", "suspended"].map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>

      <p className="text-label-caps text-on-surface-variant uppercase mt-4 mb-2">Ingest Key</p>
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded p-2">
        <code className="text-code-md font-mono text-on-surface-variant truncate flex-1">{app.ingest_key}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(app.ingest_key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-on-surface-variant hover:text-primary"
          title="Copy"
        >
          <Icon name={copied ? "check" : "content_copy"} size={16} />
        </button>
      </div>

      <div className="mt-auto pt-5 flex gap-2">
        <button onClick={() => deleteApp(app.id, onDeleted)} className="btn-secondary text-error hover:!text-error hover:!border-error">
          <Icon name="delete" size={16} />
        </button>
        <button onClick={save} disabled={saving} className="btn-primary flex-1">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

async function deleteApp(id: string, cb: () => void) {
  if (!confirm("Delete this application? Its config will be removed.")) return;
  await api.del(`/applications/${id}`);
  cb();
}

function CreateAppModal({ teams, groups, onClose, onCreated }: { teams: Team[]; groups: NotificationGroup[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", environment: "production", owningTeamId: "", notificationGroupId: "" });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.post("/applications", {
        name: form.name,
        environment: form.environment,
        owningTeamId: form.owningTeamId || null,
        notificationGroupId: form.notificationGroupId || null,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Register Application"
      onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={create} disabled={saving}>{saving ? "Creating…" : "Register"}</button>
      </>}
    >
      <Field label="Application Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. PaymentGateway-US" autoFocus /></Field>
      <Field label="Environment">
        <Select value={form.environment} onChange={(v) => setForm({ ...form, environment: v })}
          options={["production", "staging", "development"].map((e) => ({ value: e, label: e }))} />
      </Field>
      <Field label="Owning Team">
        <Select value={form.owningTeamId} onChange={(v) => setForm({ ...form, owningTeamId: v })} placeholder="Unassigned"
          options={[{ value: "", label: "Unassigned" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
      </Field>
      <Field label="Notification Routing">
        <Select value={form.notificationGroupId} onChange={(v) => setForm({ ...form, notificationGroupId: v })} placeholder="No routing"
          options={[{ value: "", label: "No routing" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
      </Field>
    </Modal>
  );
}
