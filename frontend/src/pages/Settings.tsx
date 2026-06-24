import { useEffect, useRef, useState } from "react";
import { api, branding as brandingApi, Channel, SmtpConfig } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { useToast } from "../components/Toast";
import { BrandLogo } from "../components/Layout";
import { Icon, PageHeader, Modal, Field, EmptyState } from "../components/ui";
import { Select } from "../components/Select";

const channelMeta: Record<string, { icon: string; label: string; configKey: string; placeholder: string }> = {
  slack: { icon: "tag", label: "Slack", configKey: "webhookUrl", placeholder: "https://hooks.slack.com/services/…" },
  teams: { icon: "groups", label: "Microsoft Teams", configKey: "webhookUrl", placeholder: "https://outlook.office.com/webhook/…" },
  email: { icon: "mail", label: "Email", configKey: "to", placeholder: "alerts@example.com" },
  webhook: { icon: "webhook", label: "Webhook", configKey: "url", placeholder: "https://example.com/hook" },
};

export default function Settings() {
  const toast = useToast();
  const { can } = useAuth();
  const { data: channels, refetch } = useFetch<Channel[]>("/channels");
  const { data: meta } = useFetch<{ notificationsLive: boolean }>("/meta");
  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  async function toggle(c: Channel) {
    await api.patch(`/channels/${c.id}`, { enabled: !c.enabled });
    refetch();
  }

  async function sendTest(c: Channel) {
    setTesting(c.id);
    try {
      await api.post(`/channels/${c.id}/test`);
      toast.success(`Test sent to ${c.name}.`);
    } catch (e: any) {
      toast.error(`Test failed: ${e.message}`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Platform" title="Settings & Integrations" />

      <div className={`mb-gutter rounded-xl border px-4 py-3 flex items-center gap-3 ${meta?.notificationsLive ? "border-primary/40 bg-primary/10" : "border-tertiary/40 bg-tertiary/10"}`}>
        <Icon name={meta?.notificationsLive ? "wifi_tethering" : "wifi_tethering_off"} size={20} className={meta?.notificationsLive ? "text-primary" : "text-tertiary"} />
        <div className="flex-1">
          <div className="text-body-md text-on-surface font-semibold">
            Notifications are {meta?.notificationsLive ? "LIVE" : "in dry-run mode"}
          </div>
          <div className="text-body-sm text-on-surface-variant">
            {meta?.notificationsLive
              ? "Alerts are delivered to channels in real time."
              : "Alert dispatches are logged, not sent. Set NOTIFICATIONS_LIVE=true to enable. The \"Send test\" button always delivers for real."}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2 space-y-gutter">
          {can("admin") && <BrandingCard />}

          <div className="glass-panel rounded-xl">
            <div className="px-4 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-title-sm text-on-surface flex items-center gap-2"><Icon name="hub" size={18} className="text-primary" /> Notification Channels</h3>
              <button className="btn-primary !py-1 text-body-sm" onClick={() => setCreating(true)}><Icon name="add" size={16} /> Add Channel</button>
            </div>
            {!channels?.length ? (
              <EmptyState icon="sensors_off" text="No channels configured. Add Slack, Teams, Email or a Webhook." />
            ) : (
              <div className="divide-y divide-outline-variant/40">
                {channels.map((c) => {
                  const meta = channelMeta[c.type];
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center"><Icon name={meta.icon} className="text-primary" /></div>
                      <div className="flex-1">
                        <div className="text-body-md text-on-surface font-semibold">{c.name}</div>
                        <div className="text-body-sm text-on-surface-variant font-mono truncate max-w-md">{c.config?.[meta.configKey] || "—"}</div>
                      </div>
                      <span className="text-label-caps uppercase text-on-surface-variant">{meta.label}</span>
                      <button onClick={() => sendTest(c)} disabled={testing === c.id} className="btn-secondary !h-8 !px-2.5 text-body-sm" title="Send a live test notification">
                        <Icon name={testing === c.id ? "progress_activity" : "send"} size={15} className={testing === c.id ? "animate-spin" : ""} /> Test
                      </button>
                      <button onClick={() => toggle(c)} title={c.enabled ? "Enabled" : "Disabled"} className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${c.enabled ? "bg-primary-container" : "bg-surface-bright"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-on-surface transition-transform ${c.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                      <button onClick={() => setEditing(c)} className="icon-btn"><Icon name="edit" size={18} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {can("admin") && <SmtpCard />}
        </div>

        {/* Ingest docs */}
        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-title-sm text-on-surface flex items-center gap-2 mb-3"><Icon name="code" size={18} className="text-primary" /> Sending Errors</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">Point any application at the central ingest endpoint:</p>
          <pre className="bg-surface-container-lowest border border-outline-variant rounded p-3 text-code-md font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap">{`POST /ingest
X-Api-Key: <app ingest key>
Content-Type: application/json

{
  "app": "payment-gateway-us",
  "type": "NullReferenceException",
  "message": "Object reference not set",
  "stack": "...",
  "severity": "critical",
  "environment": "production",
  "host": "prod-web-04",
  "userId": "user_123"
}`}</pre>
          <p className="text-body-sm text-on-surface-variant mt-3">The platform auto-categorizes severity & type, identifies the app, indexes to Elasticsearch, and evaluates alert thresholds.</p>
        </div>
      </div>

      {creating && <ChannelModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {editing && <ChannelModal channel={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
    </div>
  );
}

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 256 * 1024;

function BrandingCard() {
  const toast = useToast();
  const { branding, setBranding } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);
  const [appName, setAppName] = useState(branding.appName);
  const [productName, setProductName] = useState(branding.productName);
  const [tagline, setTagline] = useState(branding.tagline);
  const [logo, setLogo] = useState<string | null>(branding.logo);
  const [logoChanged, setLogoChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync local fields if branding loads/changes after mount.
  useEffect(() => {
    setAppName(branding.appName);
    setProductName(branding.productName);
    setTagline(branding.tagline);
    setLogo(branding.logo);
    setLogoChanged(false);
  }, [branding]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    // Client-side guardrails (server re-validates with magic-byte checks).
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error("Only image logos are allowed (PNG, JPG, GIF, WebP, SVG).");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Logo is too large (${Math.round(file.size / 1024)} KB). Max is 256 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result as string); setLogoChanged(true); };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogo(null);
    setLogoChanged(true);
  }

  async function save() {
    if (!appName.trim() || !productName.trim()) {
      toast.error("App name and product name are required.");
      return;
    }
    setSaving(true);
    try {
      const body: any = { appName: appName.trim(), productName: productName.trim(), tagline: tagline.trim() };
      if (logoChanged) body.logo = logo; // string (new) or null (removed)
      const updated = await brandingApi.update(body);
      setBranding(updated); // live-update sidebar/topbar/login
      setLogoChanged(false);
      toast.success("Branding updated.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel rounded-xl">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h3 className="text-title-sm text-on-surface flex items-center gap-2"><Icon name="palette" size={18} className="text-primary" /> Branding</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <BrandLogo logo={logo} size={56} />
          <div className="flex-1">
            <p className="text-body-md text-on-surface font-medium mb-1">Logo</p>
            <p className="text-body-sm text-on-surface-variant mb-2">PNG, JPG, GIF, WebP or SVG · max 256 KB. Square images look best.</p>
            <div className="flex gap-2">
              <button className="btn-secondary !h-8 text-body-sm" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={15} /> Upload logo
              </button>
              {logo && (
                <button className="btn-ghost !h-8 text-body-sm text-error" onClick={removeLogo}>
                  <Icon name="delete" size={15} /> Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={onPickFile} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="App Name (sidebar)"><input className="field" value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={40} /></Field>
          <Field label="Product Name (top bar)"><input className="field" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={40} /></Field>
        </div>
        <Field label="Tagline (login screen)"><input className="field" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} /></Field>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save branding"}</button>
        </div>
      </div>
    </div>
  );
}

function SmtpCard() {
  const toast = useToast();
  const [cfg, setCfg] = useState<SmtpConfig | null>(null);
  const [form, setForm] = useState({ host: "", port: 587, user: "", pass: "", from: "", secure: false });
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  async function load() {
    const s = await api.get<SmtpConfig>("/settings/smtp");
    setCfg(s);
    setForm({ host: s.host ?? "", port: s.port ?? 587, user: s.user ?? "", pass: "", from: s.from ?? "", secure: s.secure ?? false });
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function save() {
    setSaving(true);
    try {
      // Only send password if the user typed a new one.
      const body: any = { host: form.host, port: Number(form.port), user: form.user, from: form.from, secure: form.secure };
      if (form.pass) body.pass = form.pass;
      await api.put("/settings/smtp", body);
      toast.success("SMTP settings saved.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTo) return toast.error("Enter a recipient email.");
    setTesting(true);
    try {
      await api.post("/settings/smtp/test", { to: testTo });
      toast.success(`Test email sent to ${testTo}.`);
    } catch (e: any) {
      toast.error(`Test failed: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="glass-panel rounded-xl">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
        <h3 className="text-title-sm text-on-surface flex items-center gap-2"><Icon name="mail" size={18} className="text-primary" /> SMTP / Email</h3>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg?.configured ? "text-primary bg-primary/15" : "text-on-surface-variant bg-surface-container-highest"}`}>
          {cfg?.configured ? "Configured" : "Not configured"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <Field label="SMTP Host"><input className="field font-mono" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.yourprovider.com" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Port"><input className="field" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></Field>
          <label className="flex items-end gap-2 pb-2 cursor-pointer">
            <input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} className="accent-primary w-4 h-4" />
            <span className="text-body-sm text-on-surface">Use TLS/SSL</span>
          </label>
        </div>
        <Field label="Username"><input className="field font-mono" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} /></Field>
        <Field label={`Password ${cfg?.hasPassword ? "(set — leave blank to keep)" : ""}`}>
          <input className="field" type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder={cfg?.hasPassword ? "••••••••" : ""} />
        </Field>
        <Field label="From Address"><input className="field font-mono" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="alerts@yourcompany.com" /></Field>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save SMTP settings"}</button>
        </div>

        <div className="border-t border-outline-variant pt-3 flex items-end gap-2">
          <Field label="Send test email to"><input className="field font-mono" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@company.com" /></Field>
          <button className="btn-secondary" onClick={sendTest} disabled={testing}>
            <Icon name={testing ? "progress_activity" : "send"} size={16} className={testing ? "animate-spin" : ""} /> Send test
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelModal({ channel, onClose, onSaved }: { channel?: Channel; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<Channel["type"]>(channel?.type ?? "slack");
  const [name, setName] = useState(channel?.name ?? "");
  const meta = channelMeta[type];
  const [configValue, setConfigValue] = useState(channel?.config?.[meta.configKey] ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name) return;
    setSaving(true);
    const body = { name, type, config: { [channelMeta[type].configKey]: configValue } };
    try {
      if (channel) await api.patch(`/channels/${channel.id}`, body);
      else await api.post("/channels", body);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={channel ? "Edit Channel" : "Add Notification Channel"} onClose={onClose} footer={<>
      {channel && <button className="btn-secondary text-error mr-auto" onClick={async () => { if (confirm("Delete channel?")) { await api.del(`/channels/${channel.id}`); onSaved(); } }}><Icon name="delete" size={16} /> Delete</button>}
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
    </>}>
      <Field label="Channel Type">
        <Select value={type} disabled={!!channel} onChange={(v) => { setType(v as Channel["type"]); setConfigValue(""); }}
          options={Object.entries(channelMeta).map(([k, v]) => ({ value: k, label: v.label }))} />
      </Field>
      <Field label="Display Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack #incidents" autoFocus /></Field>
      <Field label={type === "email" ? "Recipient" : "Webhook URL"}>
        <input className="field font-mono" value={configValue} onChange={(e) => setConfigValue(e.target.value)} placeholder={meta.placeholder} />
      </Field>
    </Modal>
  );
}
