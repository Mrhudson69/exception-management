import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { BrandLogo } from "../components/Layout";
import { Icon } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message === "invalid_credentials" ? "Invalid email or password." : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm px-6">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <BrandLogo logo={branding.logo} size={44} />
          <div>
            <h1 className="text-headline-md font-bold text-primary leading-tight">{branding.productName}</h1>
            <p className="text-body-sm text-on-surface-variant">{branding.tagline}</p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-title-sm text-on-surface mb-1">Sign in</h2>
          <p className="text-body-sm text-on-surface-variant mb-5">Access the central error platform.</p>

          <form onSubmit={submit} className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-label-caps text-on-surface-variant uppercase">Email</span>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps text-on-surface-variant uppercase">Password</span>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-error text-body-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2">
                <Icon name="error" size={16} /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Icon name="progress_activity" size={18} className="animate-spin" /> : <><Icon name="login" size={18} /> Sign in</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
