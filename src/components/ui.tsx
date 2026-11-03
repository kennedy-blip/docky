import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-panel/90 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_10px_30px_-18px_rgba(0,0,0,0.8)] backdrop-blur",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-panel-2 text-cyber-light">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "xs" | "sm" | "md";

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  children,
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  const variants: Record<Variant, string> = {
    primary: "bg-indigo-electric text-white hover:bg-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_8px_20px_-10px_rgba(99,102,241,0.8)]",
    secondary: "bg-panel-2 text-slate-200 border border-line-2 hover:border-slate-500 hover:bg-slate-800",
    ghost: "text-slate-300 hover:bg-slate-800/70 hover:text-white",
    danger: "bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20",
    success: "bg-emerald-neon/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20",
    outline: "border border-cyber/50 text-cyber-light hover:bg-cyber/10",
  };
  const sizes: Record<Size, string> = {
    xs: "h-7 px-2 text-[11px] gap-1 rounded-md",
    sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
    md: "h-10 px-4 text-sm gap-2 rounded-lg",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
export type BadgeTone = "blue" | "green" | "indigo" | "amber" | "rose" | "slate" | "cyan";
export function Badge({ tone = "slate", className, children, dot, pulse }: { tone?: BadgeTone; className?: string; children: ReactNode; dot?: boolean; pulse?: boolean }) {
  const tones: Record<BadgeTone, string> = {
    blue: "bg-cyber/15 text-sky-300 border-cyber/40",
    green: "bg-emerald-neon/15 text-emerald-300 border-emerald-500/40",
    indigo: "bg-indigo-electric/15 text-indigo-300 border-indigo-500/40",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    slate: "bg-slate-700/40 text-slate-300 border-slate-600/50",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  };
  const dots: Record<BadgeTone, string> = {
    blue: "bg-sky-400",
    green: "bg-emerald-400",
    indigo: "bg-indigo-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    slate: "bg-slate-400",
    cyan: "bg-cyan-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5", tones[tone], className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", dots[tone])} />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dots[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

/* ---------- Mono chip (ports, ids) ---------- */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-sky-200 ring-1 ring-inset ring-slate-700/60", className)}>{children}</code>;
}

/* ---------- Progress / usage bar ---------- */
export function UsageBar({ value, max = 100, tone = "blue", className, label }: { value: number; max?: number; tone?: "blue" | "green" | "indigo" | "amber" | "rose"; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct > 85 ? "from-rose-500 to-rose-400" : pct > 65 ? "from-amber-500 to-amber-400" : tone === "green" ? "from-emerald-600 to-emerald-400" : tone === "indigo" ? "from-indigo-600 to-indigo-400" : "from-cyber to-sky-400";
  return (
    <div className={cn("w-full", className)} aria-label={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({ data, className, stroke = "#38bdf8", height = 28, width = 96 }: { data: number[]; className?: string; stroke?: string; height?: number; width?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 3) - 1).toFixed(1)}`);
  const d = `M${pts.join(" L")}`;
  const area = `${d} L${width},${height} L0,${height} Z`;
  const id = `sg-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("overflow-visible", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, subtitle, icon, children, size = "lg", footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; children: ReactNode; size?: "md" | "lg" | "xl"; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative flex max-h-[92vh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl border border-line-2 bg-panel shadow-2xl sm:rounded-2xl", sizes[size])}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-panel-2 text-cyber-light">{icon}</div>}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>
              {subtitle && <div className="truncate text-xs text-slate-400">{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Form helpers ---------- */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-300">
        <span>{label}</span>
        {hint && <span className="text-[11px] font-normal text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line-2 bg-panel-2 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 transition focus:border-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/60 px-3 py-2.5 text-left transition hover:border-line-2"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-200">{label}</span>
        {description && <span className="block truncate text-[11px] text-slate-500">{description}</span>}
      </span>
      <span className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", checked ? "bg-indigo-electric" : "bg-slate-700")}>
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/* ---------- Stat tile ---------- */
export function StatTile({ label, value, sub, icon, tone = "blue" }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: "blue" | "green" | "indigo" | "amber" | "rose" }) {
  const tones = {
    blue: "text-sky-300 bg-cyber/15 border-cyber/30",
    green: "text-emerald-300 bg-emerald-neon/15 border-emerald-500/30",
    indigo: "text-indigo-300 bg-indigo-electric/15 border-indigo-500/30",
    amber: "text-amber-300 bg-amber-500/15 border-amber-500/30",
    rose: "text-rose-300 bg-rose-500/15 border-rose-500/30",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate font-mono text-lg font-semibold text-slate-100">{value}</div>
        {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
      </div>
    </Card>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line-2 bg-panel-2 text-slate-500">{icon}</div>
      <div className="text-sm font-medium text-slate-200">{title}</div>
      {description && <div className="max-w-sm text-xs text-slate-500">{description}</div>}
      {action}
    </div>
  );
}
