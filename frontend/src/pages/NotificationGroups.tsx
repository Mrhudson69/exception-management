import { useState } from "react";
import { api, Channel, NotificationGroup } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Icon, PageHeader, Modal, Field, EmptyState } from "../components/ui";

const channelIcon: Record<string, string> = { slack: "tag", teams: "groups", email: "mail", webhook: "webhook" };

export default function NotificationGroups() {
  const { data: groups, refetch } = useFetch<NotificationGroup[]>("/notification-groups");
  const { data: channels } = useFetch<Channel[]>("/channels");
  const [editing, setEditing] = useState<NotificationGroup | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Notification Groups">
        <button className="btn-primary" onClick={() => setCreating(true)}><Icon name="add" size={16} /> New Group</button>
      </PageHeader>
      <p className="text-body-sm text-on-surface-variant -mt-4 mb-6">Bundle channels and direct emails into reusable routing targets.</p>

      {!groups?.length ? (
        <div className="glass-panel rounded-xl"><EmptyState icon="notifications_active" text="No notification groups yet." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {groups.map((g) => (
            <div key={g.id} className="glass-panel rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-title-sm text-on-surface">{g.name}</h3>
                  <p className="text-body-sm text-on-surface-variant">{g.description || "No description."}</p>
                </div>
                <button onClick={() => setEditing(g)} className="text-on-surface-variant hover:text-primary"><Icon name="edit" size={18} /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {g.channels?.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 bg-surface-container border border-outline-variant rounded-full px-2.5 py-1 text-body-sm text-on-surface">
                    <Icon name={channelIcon[c.type] ?? "send"} size={14} className="text-primary" /> {c.name}
                  </span>
                ))}
                {g.emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5 bg-surface-container border border-outline-variant rounded-full px-2.5 py-1 text-body-sm text-on-surface-variant">
                    <Icon name="alternate_email" size={14} /> {e}
                  </span>
                ))}
                {!g.channels?.length && !g.emails.length && <span className="text-body-sm text-outline">No targets configured.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <GroupModal channels={channels ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <GroupModal group={editing} channels={channels ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function GroupModal({ group, channels, onClose, onSaved }: { group?: NotificationGroup; channels: Channel[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [emails, setEmails] = useState((group?.emails ?? []).join(", "));
  const [channelIds, setChannelIds] = useState<string[]>(group?.channels?.map((c) => c.id) ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setChannelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!name) return;
    setSaving(true);
    const body = {
      name,
      description,
      emails: emails.split(",").map((e) => e.trim()).filter(Boolean),
      channelIds,
    };
    try {
      if (group) await api.patch(`/notification-groups/${group.id}`, body);
      else await api.post("/notification-groups", body);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={group ? "Edit Group" : "New Notification Group"} onClose={onClose} wide footer={<>
      {group && <button className="btn-secondary text-error mr-auto" onClick={async () => { if (confirm("Delete group?")) { await api.del(`/notification-groups/${group.id}`); onSaved(); } }}><Icon name="delete" size={16} /> Delete</button>}
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Group Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Description"><input className="field" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Direct Emails (comma separated)"><input className="field" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="oncall@example.com, lead@example.com" /></Field>
      <div>
        <p className="text-label-caps text-on-surface-variant uppercase mb-2">Channels</p>
        <div className="space-y-2">
          {channels.length ? channels.map((c) => (
            <label key={c.id} className="flex items-center gap-3 bg-surface-container border border-outline-variant rounded p-2 cursor-pointer hover:border-primary transition-colors">
              <input type="checkbox" checked={channelIds.includes(c.id)} onChange={() => toggle(c.id)} className="accent-primary" />
              <Icon name={channelIcon[c.type] ?? "send"} size={18} className="text-primary" />
              <span className="text-body-md text-on-surface flex-1">{c.name}</span>
              <span className="text-body-sm text-on-surface-variant uppercase">{c.type}</span>
            </label>
          )) : <p className="text-body-sm text-on-surface-variant">No channels yet — add some in Settings.</p>}
        </div>
      </div>
    </Modal>
  );
}
