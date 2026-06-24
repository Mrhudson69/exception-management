const BASE = "/api";
const TOKEN_KEY = "exmgmt_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Called when the API reports the session is no longer valid (401). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (res.status === 401) {
    tokenStore.clear();
    onUnauthorized?.();
    throw new Error("Session expired. Please sign in again.");
  }
  if (res.status === 403) throw new Error("You don't have permission to do that.");
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body: unknown) =>
    request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(p: string, body: unknown) =>
    request<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  del: (p: string) => request<void>(p, { method: "DELETE" }),
};

// ---- Auth ----
export type Role = "admin" | "editor" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ManagedUser extends AuthUser {
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  hasPassword: boolean;
  configured: boolean;
}

export interface SetupPayload {
  name: string;
  email: string;
  password: string;
  smtp?: { host?: string; port?: number; user?: string; pass?: string; from?: string; secure?: boolean };
}

export const auth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password }),
  me: () => api.get<{ user: AuthUser }>("/auth/me"),
  setupStatus: () => api.get<{ needsSetup: boolean }>("/auth/setup-status"),
  setup: (payload: SetupPayload) => api.post<{ token: string; user: AuthUser }>("/auth/setup", payload),
};

// ---- Domain types ----
export interface Application {
  id: string;
  name: string;
  slug: string;
  ingest_key: string;
  description: string | null;
  environment: string;
  status: "healthy" | "warning" | "degraded" | "critical" | "suspended";
  owning_team_id: string | null;
  notification_group_id: string | null;
  owning_team_name?: string | null;
  notification_group_name?: string | null;
  errors24h?: number;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  app_count?: number;
}

export interface Channel {
  id: string;
  name: string;
  type: "email" | "slack" | "teams" | "webhook";
  config: Record<string, any>;
  enabled: boolean;
}

export interface NotificationGroup {
  id: string;
  name: string;
  description: string | null;
  emails: string[];
  channels?: { id: string; name: string; type: string }[];
}

export interface Threshold {
  id: string;
  name: string;
  application_id: string | null;
  application_name?: string | null;
  metric: "error_count" | "error_rate" | "new_error_type";
  comparator: string;
  threshold_value: string;
  window_seconds: number;
  severity: "info" | "warning" | "error" | "critical";
  enabled: boolean;
}

export interface EscalationRule {
  id: string;
  name: string;
  threshold_id: string | null;
  threshold_name?: string | null;
  step_order: number;
  after_seconds: number;
  notification_group_id: string | null;
  notification_group_name?: string | null;
  message: string | null;
}

export interface Alert {
  id: string;
  threshold_id: string | null;
  application_id: string | null;
  application_name?: string | null;
  threshold_name?: string | null;
  severity: string;
  status: "open" | "acknowledged" | "resolved";
  title: string;
  message: string | null;
  observed_value: string | null;
  event_count: number;
  triggered_at: string;
}

export interface ExceptionDoc {
  id: string;
  app_slug: string;
  app_name: string;
  environment: string;
  severity: string;
  category: string;
  exception_type: string;
  message: string;
  stack_trace: string;
  fingerprint: string;
  host: string | null;
  user_id: string | null;
  timestamp: string;
}

export interface DashboardData {
  kpis: {
    totalErrors: number;
    criticalExceptions: number;
    activeApps: number;
    activeAlerts: number;
    severityBreakdown: { severity: string; count: number }[];
  };
  trend: { time: string; count: number }[];
  topApps: { app: string; count: number }[];
  recent: ExceptionDoc[];
}
