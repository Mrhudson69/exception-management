import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/ui";

export default function Setup() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(1);
  const [admin, setAdmin] = useState({ name: "", email: "", password: "", confirm: "" });
  const [smtp, setSmtp] = useState({ host: "", port: 587, user: "", pass: "", from: "", secure: false });
  const [configureSmtp, setConfigureSmtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function next() {
    setError(null);
    if (!admin.name || !admin.email || !admin.password) return setError("Fill in all fields.");
    if (admin.password.length < 6) return setError("Password must be at least 6 characters.");
    if (admin.password !== admin.confirm) return setError("Passwords do not match.");
    setStep(2);
  }

  async function finish() {
    setError(null);
    setSaving(true);
    try {
      await completeSetup({
        name: admin.name,
        email: admin.email,
        password: admin.password,
        smtp: configureSmtp && smtp.host ? { ...smtp, port: Number(smtp.port) } : undefined,
      });
    } catch (e: any) {
      setError(e.message ?? "Setup failed.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden py-10">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-lg px-6">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-11 h-11 rounded-full bg-primary-container flex items-center justify-center">
            <Icon name="hub" size={24} className="text-on-primary-container" />
          </div>
          <div>
            <h1 className="text-headline-md font-bold text-primary leading-tight">Welcome to OpsConsole</h1>
            <p className="text-body-sm text-on-surface-variant">Let's get your platform set up.</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-body-sm font-semibold ${step >= s ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>
                {step > s ? <Icon name="check" size={16} /> : s}
              </div>
              <span className={`text-body-sm ${step >= s ? "text-on-surface" : "text-on-surface-variant"}`}>{s === 1 ? "Admin account" : "Email (SMTP)"}</span>
              {s === 1 && <div className="w-8 h-px bg-outline-variant mx-1" />}
            </div>
          ))}
        </div>

        <div className="glass-panel rounded-xl p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-title-sm text-on-surface">Create the administrator account</h2>
              <Input label="Full Name" value={admin.name} onChange={(v) => setAdmin({ ...admin, name: v })} placeholder="Jane Admin" autoFocus />
              <Input label="Email" type="email" value={admin.email} onChange={(v) => setAdmin({ ...admin, email: v })} placeholder="admin@yourcompany.com" mono />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Password" type="password" value={admin.password} onChange={(v) => setAdmin({ ...admin, password: v })} placeholder="min 6 chars" />
                <Input label="Confirm" type="password" value={admin.confirm} onChange={(v) => setAdmin({ ...admin, confirm: v })} placeholder="repeat" />
              </div>
              {error && <ErrorMsg text={error} />}
              <button onClick={next} className="btn-primary w-full">Continue <Icon name="arrow_forward" size={18} /></button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-title-sm text-on-surface">Email delivery (optional)</h2>
              <p className="text-body-sm text-on-surface-variant">Configure SMTP so the platform can send email alerts. You can skip this and set it later in Settings.</p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={configureSmtp} onChange={(e) => setConfigureSmtp(e.target.checked)} className="accent-primary w-4 h-4" />
                <span className="text-body-md text-on-surface">Configure SMTP now</span>
              </label>

              {configureSmtp && (
                <div className="space-y-3 pt-1">
                  <Input label="SMTP Host" value={smtp.host} onChange={(v) => setSmtp({ ...smtp, host: v })} placeholder="smtp.yourprovider.com" mono />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Port" type="number" value={String(smtp.port)} onChange={(v) => setSmtp({ ...smtp, port: Number(v) })} />
                    <label className="flex items-end gap-2 pb-2 cursor-pointer">
                      <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} className="accent-primary w-4 h-4" />
                      <span className="text-body-sm text-on-surface">Use TLS/SSL (465)</span>
                    </label>
                  </div>
                  <Input label="Username" value={smtp.user} onChange={(v) => setSmtp({ ...smtp, user: v })} placeholder="apikey / user" mono />
                  <Input label="Password" type="password" value={smtp.pass} onChange={(v) => setSmtp({ ...smtp, pass: v })} />
                  <Input label="From Address" value={smtp.from} onChange={(v) => setSmtp({ ...smtp, from: v })} placeholder="alerts@yourcompany.com" mono />
                </div>
              )}

              {error && <ErrorMsg text={error} />}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(1)} className="btn-secondary"><Icon name="arrow_back" size={18} /> Back</button>
                <button onClick={finish} disabled={saving} className="btn-primary flex-1">
                  {saving ? <Icon name="progress_activity" size={18} className="animate-spin" /> : <><Icon name="check_circle" size={18} /> Finish setup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, mono, autoFocus }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; mono?: boolean; autoFocus?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-caps text-on-surface-variant uppercase">{label}</span>
      <input className={`field ${mono ? "font-mono" : ""}`} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
    </label>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-error text-body-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2">
      <Icon name="error" size={16} /> {text}
    </div>
  );
}
