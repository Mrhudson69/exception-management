import { useState } from "react";
import { api, ManagedUser, Role } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { Icon, PageHeader, Modal, Field, EmptyState, timeAgo } from "../components/ui";
import { Select } from "../components/Select";

const roleMeta: Record<Role, { label: string; cls: string; desc: string }> = {
  admin: { label: "Admin", cls: "text-error bg-error/15", desc: "Full access incl. user management" },
  editor: { label: "Editor", cls: "text-tertiary bg-tertiary/15", desc: "Manage config, ack/resolve alerts" },
  viewer: { label: "Viewer", cls: "text-primary bg-primary/15", desc: "Read-only access" },
};

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data: users, refetch } = useFetch<ManagedUser[]>("/users");
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);

  async function remove(u: ManagedUser) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    try {
      await api.del(`/users/${u.id}`);
      toast.success("User deleted.");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Administration" title="User Management">
        <button className="btn-primary" onClick={() => setCreating(true)}><Icon name="person_add" size={16} /> Add User</button>
      </PageHeader>
      <p className="text-body-sm text-on-surface-variant -mt-4 mb-6">Manage who can access the platform and what they can do.</p>

      <div className="glass-panel rounded-xl overflow-x-auto">
        {!users?.length ? (
          <EmptyState icon="group" text="No users." />
        ) : (
          <table className="w-full text-left min-w-[640px]">
            <thead className="border-b border-outline-variant">
              <tr>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase">User</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-32">Role</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-28">Status</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-32">Last login</th>
                <th className="py-2.5 px-4 text-label-caps text-on-surface-variant uppercase w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/30 hover-row">
                  <td className="py-3 px-4">
                    <div className="text-body-md text-on-surface font-semibold flex items-center gap-2">
                      {u.name}
                      {u.id === me?.id && <span className="text-[11px] text-primary bg-primary/10 px-1.5 rounded-full">you</span>}
                    </div>
                    <div className="text-body-sm text-on-surface-variant font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-4"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleMeta[u.role].cls}`}>{roleMeta[u.role].label}</span></td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-body-sm ${u.active ? "text-primary" : "text-outline"}`}>
                      <span className={`w-2 h-2 rounded-full ${u.active ? "bg-primary" : "bg-outline"}`} /> {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-body-sm text-on-surface-variant">{u.last_login_at ? timeAgo(u.last_login_at) : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(u)} className="icon-btn"><Icon name="edit" size={18} /></button>
                      {u.id !== me?.id && <button onClick={() => remove(u)} className="icon-btn hover:!text-error"><Icon name="delete" size={18} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <UserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user?: ManagedUser; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "viewer");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(user?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || (!user && (!email || !password))) {
      toast.error("Fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      if (user) {
        await api.patch(`/users/${user.id}`, { name, role, active, ...(password ? { password } : {}) });
      } else {
        await api.post("/users", { name, email, role, password });
      }
      toast.success(user ? "User updated." : "User created.");
      onSaved();
    } catch (e: any) {
      toast.error(e.message === "email_taken" ? "That email is already in use." : e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={user ? "Edit User" : "Add User"} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Full Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Email"><input className="field font-mono" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
      <Field label="Role">
        <Select value={role} onChange={(v) => setRole(v as Role)} options={(["admin", "editor", "viewer"] as Role[]).map((r) => ({ value: r, label: roleMeta[r].label, hint: roleMeta[r].desc }))} />
      </Field>
      <Field label={user ? "New Password (leave blank to keep)" : "Password"}>
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={user ? "••••••••" : "min 6 characters"} />
      </Field>
      {user && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary w-4 h-4" />
          <span className="text-body-sm text-on-surface">Account active</span>
        </label>
      )}
    </Modal>
  );
}
