import { Boxes, Download, Eraser, FileCode2, Network, Search, Activity } from "lucide-react";
import type { TabId } from "../types";
import { cn } from "../utils/cn";

export function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* container stack */}
      <g fill="currentColor">
        <rect x="12" y="16" width="6" height="5" rx="0.8" />
        <rect x="19" y="16" width="6" height="5" rx="0.8" />
        <rect x="26" y="16" width="6" height="5" rx="0.8" />
        <rect x="19" y="10" width="6" height="5" rx="0.8" />
        <rect x="26" y="10" width="6" height="5" rx="0.8" />
        <rect x="26" y="4" width="6" height="5" rx="0.8" />
        <rect x="33" y="16" width="6" height="5" rx="0.8" />
      </g>
      {/* whale body */}
      <path
        d="M4 24.5c0-1 .8-1.8 1.8-1.8H40c1.5 0 2.5-.8 3.2-1.8.5-.8 1.6-.9 2.2-.1.6.7.5 1.9-.1 2.6-.6.7-1.3 1.2-2.1 1.6-.4 6.8-5.3 12.5-15.8 12.5-9.6 0-15.6-4.2-18.1-9.1L4 24.5z"
        fill="currentColor"
        opacity="0.95"
      />
      <circle cx="35" cy="27" r="1.3" fill="#090d16" />
      {/* waves */}
      <path d="M3 40c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

const tabs: { id: TabId; label: string; short: string; icon: React.ReactNode }[] = [
  { id: "fleet", label: "Containers Fleet", short: "Fleet", icon: <Boxes className="h-4 w-4" /> },
  { id: "dockerfile", label: "Dockerfile Generator", short: "Dockerfile", icon: <FileCode2 className="h-4 w-4" /> },
  { id: "compose", label: "Compose Visualizer", short: "Compose", icon: <Network className="h-4 w-4" /> },
  { id: "registry", label: "Registry Search", short: "Registry", icon: <Search className="h-4 w-4" /> },
];

interface Props {
  active: TabId;
  onChange: (t: TabId) => void;
  onPrune: () => void;
  onExport: () => void;
  runningCount: number;
  totalCount: number;
}

export function Header({ active, onChange, onPrune, onExport, runningCount, totalCount }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="glow-ring relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyber to-sky-500 text-white">
              <WhaleIcon className="glow-cyber h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold tracking-tight text-white">
                  Docker<span className="bg-gradient-to-r from-sky-300 to-indigo-300 bg-clip-text text-transparent">Pulse</span>
                </h1>
                <span className="hidden rounded border border-line-2 bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">v1.4.0</span>
              </div>
              <p className="hidden truncate text-[11px] text-slate-500 md:block">Container fleet manager · Dockerfile generator · Compose visualizer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-neon/10 px-2.5 py-1.5 sm:flex" title="Engine 24.0.7 · containerd 1.7.11">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-medium text-emerald-300">Docker Daemon: Running</span>
              <span className="hidden font-mono text-[10px] text-emerald-400/70 lg:inline">
                {runningCount}/{totalCount} up
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-neon/10 px-2 py-1.5 sm:hidden" title="Docker Daemon: Running">
              <Activity className="h-3.5 w-3.5 text-emerald-300" />
              <span className="font-mono text-[10px] text-emerald-300">
                {runningCount}/{totalCount}
              </span>
            </div>

            <button
              onClick={onPrune}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-panel-2 px-2.5 text-xs font-medium text-slate-200 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200"
              title="Prune unused images"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Prune Unused Images</span>
              <span className="hidden sm:inline lg:hidden">Prune</span>
            </button>
            <button
              onClick={onExport}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-electric px-2.5 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_8px_20px_-10px_rgba(99,102,241,0.9)] transition hover:bg-indigo-500"
              title="Export compose YAML"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Export Compose YAML</span>
              <span className="hidden sm:inline lg:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="-mb-3 flex gap-1 overflow-x-auto" aria-label="Primary">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium transition sm:text-[13px]",
                  isActive ? "border-cyber-light text-white" : "border-transparent text-slate-400 hover:text-slate-200",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={cn(isActive ? "text-cyber-light" : "text-slate-500")}>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
                {isActive && <span className="absolute inset-x-2 -bottom-[2px] h-[2px] bg-cyber-light blur-[3px]" />}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
