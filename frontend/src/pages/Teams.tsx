import { useState } from "react";
import { api, Team } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, Modal, Field, EmptyState } from "../components/ui";

export default function Teams() {
  const { data: teams, refetch } = useFetch<Team[]>("/teams");
  const [editing, setEditing] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Teams">
        <button className="btn-primary" onClick={() => setCreating(true)}><Icon name="add" size={16} /> New Team</button>
      </PageHeader>

      {!teams?.length ? (
        <div className="glass-panel rounded-xl"><EmptyState icon="group" text="No teams yet. Create one to assign application ownership." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {teams.map((t) => (
            <div key={t.id} className="glass-panel rounded-xl p-4 flex flex-col">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center"><Icon name="group" className="text-primary" /></div>
                  <div>
                    <h3 className="text-title-sm text-on-surface">{t.name}</h3>
                    <p className="text-body-sm text-on-surface-variant font-mono">{t.slug}</p>
                  </div>
                </div>
                <button onClick={() => setEditing(t)} className="text-on-surface-variant hover:text-primary"><Icon name="edit" size={18} /></button>
              </div>
              <p className="text-body-sm text-on-surface-variant mt-3 flex-1">{t.description || "No description."}</p>
              <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-2 text-body-sm text-on-surface-variant">
                <Icon name="apps" size={16} /> {t.app_count ?? 0} application{(t.app_count ?? 0) === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <TeamModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <TeamModal team={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function TeamModal({ team, onClose, onSaved }: { team?: Team; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name) return;
    setSaving(true);
    try {
      if (team) await api.patch(`/teams/${team.id}`, { name, description });
      else await api.post("/teams", { name, description });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={team ? "Edit Team" : "New Team"} onClose={onClose} footer={<>
      {team && <button className="btn-secondary text-error mr-auto" onClick={async () => { if (confirm("Delete team?")) { await api.del(`/teams/${team.id}`); onSaved(); } }}><Icon name="delete" size={16} /> Delete</button>}
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Team Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Description"><textarea className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
    </Modal>
  );
}
