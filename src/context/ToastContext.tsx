import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Toast, ToastKind } from "../types";
import { cn } from "../utils/cn";

interface ToastApi {
  toast: (kind: ToastKind, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = seq++;
      setToasts((t) => [...t.slice(-4), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  const icons: Record<ToastKind, ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    error: <XCircle className="h-4 w-4 text-rose-400" />,
    info: <Info className="h-4 w-4 text-sky-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  };
  const borders: Record<ToastKind, string> = {
    success: "border-emerald-500/40",
    error: "border-rose-500/40",
    info: "border-cyber/40",
    warning: "border-amber-500/40",
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn("pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border bg-panel/95 px-4 py-3 shadow-2xl backdrop-blur", borders[t.kind])}
            role="status"
          >
            <div className="mt-0.5 shrink-0">{icons[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-100">{t.title}</div>
              {t.description && <div className="mt-0.5 font-mono text-[11px] leading-relaxed text-slate-400">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
