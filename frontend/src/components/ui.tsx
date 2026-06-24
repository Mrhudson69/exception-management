import { ReactNode } from "react";

export function Icon({ name, className, size = 20 }: { name: string; className?: string; size?: number }) {
  return (
    <span className={`material-symbols-outlined ${className ?? ""}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

export const severityStyles: Record<string, { text: string; bg: string; dot: string; label: string }> = {
  critical: { text: "text-error", bg: "bg-error/20", dot: "bg-error", label: "Critical" },
  error: { text: "text-tertiary", bg: "bg-tertiary/20", dot: "bg-tertiary", label: "Error" },
  warning: { text: "text-tertiary-fixed-dim", bg: "bg-tertiary-fixed-dim/20", dot: "bg-tertiary-fixed-dim", label: "Warning" },
  info: { text: "text-primary", bg: "bg-primary/20", dot: "bg-primary", label: "Info" },
};

export const statusStyles: Record<string, { text: string; dot: string; label: string }> = {
  healthy: { text: "text-primary", dot: "bg-primary", label: "Healthy" },
  warning: { text: "text-tertiary-fixed-dim", dot: "bg-tertiary-fixed-dim", label: "Warning" },
  degraded: { text: "text-tertiary", dot: "bg-tertiary", label: "Degraded" },
  critical: { text: "text-error", dot: "bg-error", label: "Critical" },
  suspended: { text: "text-outline", dot: "bg-outline", label: "Suspended" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severityStyles[severity] ?? severityStyles.info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusStyles.healthy;
  return (
    <span className={`inline-flex items-center gap-2 text-body-sm font-semibold ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`glass-panel rounded-xl flex flex-col ${className ?? ""}`}>
      {(title || action) && (
        <div className="px-4 py-3 border-b border-outline-variant flex justify-between items-center shrink-0">
          <h3 className="text-title-sm text-on-surface flex items-center gap-2">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-title-sm text-on-surface-variant mb-1 uppercase tracking-wider">{eyebrow}</h2>
        <h1 className="text-display-lg text-on-surface">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass-panel rounded-xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] flex flex-col shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center">
          <h3 className="text-title-sm text-on-surface">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-outline-variant flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-caps text-on-surface-variant uppercase">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
      <Icon name={icon} size={40} className="text-outline" />
      <p className="text-body-md">{text}</p>
    </div>
  );
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
