import { createContext, useContext, useState, ReactNode } from "react";
import { Icon } from "./ui";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastCtx = createContext<ToastApi>(null as any);

const styles: Record<ToastKind, { icon: string; cls: string }> = {
  success: { icon: "check_circle", cls: "border-l-primary text-primary" },
  error: { icon: "error", cls: "border-l-error text-error" },
  info: { icon: "info", cls: "border-l-secondary text-secondary" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const api: ToastApi = {
    push,
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80 max-w-[90vw]">
        {toasts.map((t) => {
          const s = styles[t.kind];
          return (
            <div key={t.id} className={`glass-panel rounded-lg border-l-4 ${s.cls} px-4 py-3 flex items-start gap-3 shadow-2xl animate-[slidein_0.2s_ease-out]`}>
              <Icon name={s.icon} size={18} />
              <span className="text-body-sm text-on-surface flex-1">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
