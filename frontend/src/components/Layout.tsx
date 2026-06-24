import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Icon, SeverityBadge, timeAgo } from "./ui";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./Toast";
import { api, Alert, Role } from "../api/client";

const navItems: { to: string; icon: string; label: string; end?: boolean; minRole?: Role }[] = [
  { to: "/", icon: "dashboard", label: "Dashboard", end: true },
  { to: "/applications", icon: "apps", label: "Applications" },
  { to: "/errors", icon: "bug_report", label: "Error Logs" },
  { to: "/alerts", icon: "warning", label: "Alerts" },
  { to: "/teams", icon: "group", label: "Teams" },
  { to: "/notification-groups", icon: "notifications_active", label: "Notification Groups" },
  { to: "/thresholds", icon: "speed", label: "Thresholds" },
  { to: "/escalations", icon: "trending_up", label: "Escalations" },
  { to: "/users", icon: "manage_accounts", label: "Users", minRole: "admin" },
  { to: "/settings", icon: "settings", label: "Settings" },
];

function SideNav({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  return (
    <nav
      className={`bg-surface-container-low h-screen w-[260px] sm:w-[240px] shrink-0 border-r border-outline-variant flex flex-col py-gutter
        fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      <div className="px-container-padding pb-6 mb-4 border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
            <Icon name="hub" size={18} className="text-on-primary-container" />
          </div>
          <div className="flex-1">
            <h1 className="text-headline-md font-bold text-primary leading-tight">System Ops</h1>
            <p className="text-body-sm text-on-surface-variant">v2.4.0-stable</p>
          </div>
          <button onClick={onClose} className="md:hidden icon-btn -mr-2" aria-label="Close menu">
            <Icon name="close" size={20} />
          </button>
        </div>
        <button
          onClick={() => navigate("/applications?new=1")}
          className="mt-4 w-full bg-primary-container text-on-primary-container text-body-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors"
        >
          <Icon name="add" size={18} /> New Project
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {navItems.filter((i) => !i.minRole || can(i.minRole)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 ${
                isActive
                  ? "text-primary font-medium bg-secondary-container/30 border-l-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            <span className="text-body-md">{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="px-2 pt-4 border-t border-outline-variant mt-auto space-y-1">
        <NavLink to="/docs" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "text-primary bg-secondary-container/30" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"}`}>
          <Icon name="description" size={20} />
          <span className="text-body-md">Documentation</span>
        </NavLink>
        <NavLink to="/support" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "text-primary bg-secondary-container/30" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"}`}>
          <Icon name="help" size={20} />
          <span className="text-body-md">Support</span>
        </NavLink>
      </div>
    </nav>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  async function load() {
    try {
      setAlerts(await api.get<Alert[]>("/alerts?status=open"));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative" onClick={() => { setOpen((o) => !o); load(); }}>
        <Icon name="notifications" size={20} />
        {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-error text-on-error rounded-full flex items-center justify-center">{alerts.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <span className="text-title-sm text-on-surface">Open Alerts</span>
            <span className="text-body-sm text-on-surface-variant">{alerts.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-body-sm text-on-surface-variant">No open alerts 🎉</div>
            ) : (
              alerts.slice(0, 8).map((a) => (
                <button key={a.id} onClick={() => { setOpen(false); navigate("/alerts"); }} className="w-full text-left px-4 py-3 border-b border-outline-variant/30 hover:bg-surface-container-highest transition-colors flex gap-3">
                  <SeverityBadge severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm text-on-surface truncate">{a.title}</div>
                    <div className="text-[11px] text-on-surface-variant">{timeAgo(a.triggered_at)} · {a.event_count} events</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <button onClick={() => { setOpen(false); navigate("/alerts"); }} className="w-full px-4 py-2.5 text-body-sm text-primary hover:bg-surface-container-highest transition-colors border-t border-outline-variant">View all alerts</button>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const initials = (user?.name ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const roleCls: Record<string, string> = { admin: "text-error", editor: "text-tertiary", viewer: "text-primary" };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container border border-outline-variant flex items-center justify-center text-body-sm font-semibold hover:border-primary transition-colors">
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant">
            <div className="text-body-md text-on-surface font-semibold truncate">{user?.name}</div>
            <div className="text-body-sm text-on-surface-variant font-mono truncate">{user?.email}</div>
            <div className={`text-[11px] font-semibold uppercase mt-1 ${roleCls[user?.role ?? "viewer"]}`}>{user?.role}</div>
          </div>
          <button onClick={logout} className="w-full text-left px-4 py-2.5 text-body-sm text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2">
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [env, setEnv] = useState("Prod");

  function onSearch(e: React.KeyboardEvent) {
    if (e.key === "Enter" && q.trim()) {
      navigate(`/errors?q=${encodeURIComponent(q.trim())}`);
      setQ("");
    }
  }

  return (
    <header className="bg-surface h-14 w-full sticky top-0 z-30 border-b border-outline-variant flex justify-between items-center px-4 sm:px-container-padding shrink-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-6 h-full min-w-0">
        <button onClick={onMenu} className="md:hidden icon-btn shrink-0" aria-label="Open menu">
          <Icon name="menu" size={22} />
        </button>
        <span className="text-title-sm sm:text-headline-md font-bold text-primary tracking-tight truncate">OpsConsole</span>
        <nav className="hidden md:flex items-center gap-6 h-full ml-2">
          {["Prod", "Staging", "Dev"].map((e) => (
            <button key={e} onClick={() => { setEnv(e); toast.info(`Switched to ${e} environment`); }} className={`h-full flex items-center px-1 transition-colors ${env === e ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`}>{e}</button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="relative hidden sm:block">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearch}
            className="bg-surface-container border border-outline-variant rounded-full py-1.5 pl-9 pr-4 text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-40 lg:w-56 transition-all"
            placeholder="Search errors… ↵"
          />
        </div>
        <button onClick={() => navigate("/errors")} className="sm:hidden icon-btn" aria-label="Search errors">
          <Icon name="search" size={20} />
        </button>
        <NotificationsBell />
        <button
          onClick={() => toast.success("Deployment triggered for " + env + " ✓")}
          className="btn-secondary !h-9 hidden sm:inline-flex"
        >
          <Icon name="rocket_launch" size={16} /> Deploy
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="h-screen flex overflow-hidden bg-background text-on-surface">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <SideNav mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main key={location.pathname} className="flex-1 overflow-y-auto p-4 sm:p-container-padding bg-[#0F172A]">
          {children}
        </main>
      </div>
    </div>
  );
}
