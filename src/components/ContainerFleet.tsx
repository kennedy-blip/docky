import { useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  ChevronDown,
  Cpu,
  HardDrive,
  Layers,
  MemoryStick,
  Play,
  RefreshCw,
  RotateCw,
  ScrollText,
  Search,
  Square,
  Terminal,
  Trash2,
  Network as NetworkIcon,
  FolderOpen,
  KeyRound,
  Clock,
  Filter,
} from "lucide-react";
import type { Container, ContainerStatus } from "../types";
import type { FleetApi } from "../hooks/useFleet";
import { formatSize, formatUptime, timeAgo } from "../hooks/useFleet";
import { Badge, Button, Card, CardHeader, Empty, Mono, Sparkline, StatTile, UsageBar, inputCls } from "./ui";
import { cn } from "../utils/cn";
import { useToast } from "../context/ToastContext";
import { LogsModal, ShellModal } from "./ContainerModals";

type Filter = "all" | ContainerStatus;

const statusMeta: Record<ContainerStatus, { label: string; tone: "green" | "amber" | "slate"; pulse: boolean }> = {
  running: { label: "Running", tone: "green", pulse: true },
  restarting: { label: "Restarting", tone: "amber", pulse: true },
  stopped: { label: "Stopped", tone: "slate", pulse: false },
};

export function ContainerFleet({ fleet }: { fleet: FleetApi }) {
  const { containers, images, now, start, stop, restart, remove } = fleet;
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<Container | null>(null);
  const [shellFor, setShellFor] = useState<Container | null>(null);

  const counts = useMemo(() => {
    const c = { running: 0, restarting: 0, stopped: 0 };
    containers.forEach((x) => c[x.status]++);
    return c;
  }, [containers]);

  const totalCpu = containers.reduce((s, c) => s + c.cpu, 0);
  const totalMem = containers.reduce((s, c) => s + c.mem, 0);
  const totalMemLimit = containers.reduce((s, c) => s + c.memLimit, 0);
  const imagesSize = images.reduce((s, i) => s + i.sizeMb, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return containers.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q) || c.id.includes(q) || c.ports.some((p) => String(p.host).includes(q));
    });
  }, [containers, query, filter]);

  // keep modal container data fresh
  const liveLogs = logsFor ? containers.find((c) => c.id === logsFor.id) ?? null : null;
  const liveShell = shellFor ? containers.find((c) => c.id === shellFor.id) ?? null : null;

  const handle = (action: "start" | "stop" | "restart" | "remove", c: Container) => {
    switch (action) {
      case "start":
        start(c.id);
        toast("success", `Started ${c.name}`, `docker start ${c.id}`);
        break;
      case "stop":
        stop(c.id);
        toast("info", `Stopped ${c.name}`, `docker stop ${c.id}`);
        break;
      case "restart":
        restart(c.id);
        toast("warning", `Restarting ${c.name}`, `docker restart ${c.id}`);
        break;
      case "remove":
        remove(c.id);
        toast("error", `Removed ${c.name}`, `docker rm ${c.id}`);
        break;
    }
  };

  const startAll = () => {
    const stopped = containers.filter((c) => c.status === "stopped");
    stopped.forEach((c) => start(c.id));
    toast("success", `Started ${stopped.length} container${stopped.length === 1 ? "" : "s"}`, "docker compose up -d");
  };
  const stopAll = () => {
    const running = containers.filter((c) => c.status === "running");
    running.forEach((c) => stop(c.id));
    toast("info", `Stopped ${running.length} container${running.length === 1 ? "" : "s"}`, "docker compose stop");
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Running" value={counts.running} sub={`${containers.length} total`} icon={<Play className="h-4 w-4" />} tone="green" />
        <StatTile label="Restarting" value={counts.restarting} sub={counts.restarting ? "flapping" : "stable"} icon={<RotateCw className={cn("h-4 w-4", counts.restarting && "animate-spin-slow")} />} tone="amber" />
        <StatTile label="Stopped" value={counts.stopped} sub="exited (0)" icon={<Square className="h-4 w-4" />} tone="rose" />
        <StatTile label="Fleet CPU" value={`${totalCpu.toFixed(1)}%`} sub="8 vCPU host" icon={<Cpu className="h-4 w-4" />} tone="blue" />
        <StatTile label="Fleet Memory" value={formatSize(totalMem)} sub={`of ${formatSize(totalMemLimit)} limit`} icon={<MemoryStick className="h-4 w-4" />} tone="indigo" />
        <StatTile label="Images" value={images.length} sub={formatSize(imagesSize)} icon={<Layers className="h-4 w-4" />} tone="blue" />
      </div>

      {/* List */}
      <Card>
        <CardHeader
          icon={<Boxes className="h-4 w-4" />}
          title="Container Fleet"
          subtitle={`${filtered.length} of ${containers.length} containers · metrics refresh every 1.5s`}
          actions={
            <>
              <Button variant="success" size="xs" icon={<Play className="h-3 w-3" />} onClick={startAll} disabled={!counts.stopped}>
                Start all
              </Button>
              <Button variant="danger" size="xs" icon={<Square className="h-3 w-3" />} onClick={stopAll} disabled={!counts.running}>
                Stop all
              </Button>
            </>
          }
        />
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, image, ID or port…" className={cn(inputCls, "pl-9 font-mono text-xs")} />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-500" />
            {(["all", "running", "restarting", "stopped"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium capitalize transition",
                  filter === f ? "border-indigo-500/60 bg-indigo-electric/20 text-indigo-200" : "border-line-2 bg-panel-2 text-slate-400 hover:text-slate-200",
                )}
              >
                {f}
                <span className="ml-1 font-mono text-[10px] opacity-70">{f === "all" ? containers.length : counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table header (desktop) */}
        <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_auto] gap-4 border-b border-line px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 xl:grid">
          <div>Container</div>
          <div>Ports</div>
          <div>Uptime</div>
          <div>CPU</div>
          <div>Memory</div>
          <div className="w-[292px] text-right">Actions</div>
        </div>

        {filtered.length === 0 ? (
          <Empty icon={<Boxes className="h-5 w-5" />} title="No containers match" description="Try a different search term or clear the status filter." action={<Button size="xs" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((c) => (
              <ContainerRow
                key={c.id}
                c={c}
                now={now}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                onAction={(a) => handle(a, c)}
                onLogs={() => setLogsFor(c)}
                onShell={() => setShellFor(c)}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Images */}
      <Card>
        <CardHeader icon={<HardDrive className="h-4 w-4" />} title="Local Images" subtitle={`${images.length} images · ${formatSize(imagesSize)} on disk · ${images.filter((i) => i.dangling).length} dangling`} />
        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => {
            const used = containers.some((c) => c.image === `${img.repository}:${img.tag}`);
            return (
              <div key={img.id} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", img.dangling ? "border-dashed border-rose-500/30 bg-rose-500/5" : "border-line bg-panel-2/50")}>
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-slate-200">
                    {img.repository}
                    <span className="text-slate-500">:</span>
                    <span className="text-sky-300">{img.tag}</span>
                  </div>
                  <div className="truncate font-mono text-[10px] text-slate-500">
                    {img.id.slice(7, 19)} · {timeAgo(img.createdAt, now)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-[11px] text-slate-300">{formatSize(img.sizeMb)}</span>
                  {img.dangling ? <Badge tone="rose">dangling</Badge> : used ? <Badge tone="green">in use</Badge> : <Badge tone="slate">unused</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <LogsModal container={liveLogs} onClose={() => setLogsFor(null)} />
      <ShellModal container={liveShell} onClose={() => setShellFor(null)} />
    </div>
  );
}

/* ---------- Row ---------- */
function ContainerRow({
  c,
  now,
  expanded,
  onToggle,
  onAction,
  onLogs,
  onShell,
}: {
  c: Container;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onAction: (a: "start" | "stop" | "restart" | "remove") => void;
  onLogs: () => void;
  onShell: () => void;
}) {
  const meta = statusMeta[c.status];
  const isRunning = c.status === "running";
  const isRestarting = c.status === "restarting";
  const memPct = (c.mem / c.memLimit) * 100;

  return (
    <li className={cn("transition-colors", expanded && "bg-panel-2/40")}>
      <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:px-5 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_auto] xl:items-center xl:gap-4">
        {/* Identity */}
        <div className="flex min-w-0 items-start gap-3">
          <button onClick={onToggle} className="mt-0.5 rounded p-0.5 text-slate-500 transition hover:bg-slate-800 hover:text-white" aria-label="Toggle details">
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">{c.name}</span>
              <Badge tone={meta.tone} dot pulse={meta.pulse}>
                {meta.label}
              </Badge>
              {c.health === "healthy" && isRunning && <Badge tone="cyan">healthy</Badge>}
              {c.health === "starting" && <Badge tone="amber">health: starting</Badge>}
              {c.restarts > 3 && <Badge tone="rose">{c.restarts} restarts</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-400">
              <span className="text-sky-300/90">{c.image}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{c.id}</span>
            </div>
          </div>
        </div>

        {/* Ports */}
        <div className="flex flex-wrap items-center gap-1.5 pl-8 xl:pl-0">
          {c.ports.length === 0 ? (
            <span className="text-[11px] text-slate-600">no published ports</span>
          ) : (
            c.ports.map((p) => (
              <Mono key={`${p.host}-${p.container}`} className={cn(!isRunning && "opacity-50")}>
                {p.host}
                <span className="text-slate-500">:</span>
                {p.container}
                <span className="text-slate-600">/{p.proto}</span>
              </Mono>
            ))
          )}
        </div>

        {/* Uptime */}
        <div className="flex items-center gap-1.5 pl-8 font-mono text-xs text-slate-300 xl:pl-0">
          <Clock className="h-3.5 w-3.5 text-slate-500 xl:hidden" />
          {isRestarting ? <span className="text-amber-300">restarting…</span> : <span className={cn(!isRunning && "text-slate-600")}>{formatUptime(c.startedAt, now)}</span>}
        </div>

        {/* CPU */}
        <div className="flex items-center gap-3 pl-8 xl:pl-0">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-slate-500 xl:hidden" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-500">CPU</span>
              <span className={cn("text-slate-200", c.cpu > 60 && "text-amber-300", c.cpu > 85 && "text-rose-300")}>{c.cpu.toFixed(1)}%</span>
            </div>
            <UsageBar value={c.cpu} />
          </div>
          <Sparkline data={c.cpuHistory} width={72} height={22} stroke={isRunning ? "#38bdf8" : "#475569"} className="hidden shrink-0 sm:block" />
        </div>

        {/* Memory */}
        <div className="flex items-center gap-3 pl-8 xl:pl-0">
          <MemoryStick className="h-3.5 w-3.5 shrink-0 text-slate-500 xl:hidden" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-500">MEM</span>
              <span className="text-slate-200">
                {Math.round(c.mem)}
                <span className="text-slate-500">/{c.memLimit} MiB</span>
              </span>
            </div>
            <UsageBar value={memPct} tone="indigo" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 pl-8 xl:w-[292px] xl:justify-end xl:pl-0">
          {isRunning ? (
            <Button size="xs" variant="danger" icon={<Square className="h-3 w-3" />} onClick={() => onAction("stop")}>
              Stop
            </Button>
          ) : (
            <Button size="xs" variant="success" icon={<Play className="h-3 w-3" />} onClick={() => onAction("start")} disabled={isRestarting}>
              Start
            </Button>
          )}
          <Button size="xs" variant="secondary" icon={<RefreshCw className={cn("h-3 w-3", isRestarting && "animate-spin")} />} onClick={() => onAction("restart")} disabled={isRestarting}>
            Restart
          </Button>
          <Button size="xs" variant="secondary" icon={<ScrollText className="h-3 w-3" />} onClick={onLogs}>
            Logs
          </Button>
          <Button size="xs" variant="outline" icon={<Terminal className="h-3 w-3" />} onClick={onShell} disabled={!isRunning} title={isRunning ? "Open interactive shell" : "Container must be running"}>
            Shell
          </Button>
          {c.status === "stopped" && (
            <button onClick={() => onAction("remove")} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300" title="Remove container">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in grid grid-cols-1 gap-4 border-t border-line/60 bg-ink/40 px-5 py-4 pl-12 text-xs md:grid-cols-2 xl:grid-cols-4">
          <Detail icon={<Activity className="h-3.5 w-3.5" />} label="Command">
            <Mono className="whitespace-pre-wrap break-all">{c.command}</Mono>
            <div className="mt-2 text-[11px] text-slate-500">
              Created {timeAgo(c.createdAt, now)} · Restarts: <span className="font-mono text-slate-300">{c.restarts}</span>
            </div>
          </Detail>
          <Detail icon={<NetworkIcon className="h-3.5 w-3.5" />} label="Networks">
            <div className="flex flex-wrap gap-1.5">
              {c.networks.map((n) => (
                <Badge key={n} tone="indigo">
                  {n}
                </Badge>
              ))}
            </div>
            <div className="mt-2 font-mono text-[11px] text-slate-500">IP 172.18.0.{(parseInt(c.id.slice(0, 2), 16) % 200) + 2}</div>
          </Detail>
          <Detail icon={<FolderOpen className="h-3.5 w-3.5" />} label="Mounts">
            {c.mounts.length === 0 ? (
              <span className="text-slate-600">none</span>
            ) : (
              <ul className="space-y-1">
                {c.mounts.map((m) => (
                  <li key={m} className="break-all font-mono text-[11px] text-emerald-300/90">
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </Detail>
          <Detail icon={<KeyRound className="h-3.5 w-3.5" />} label="Environment">
            {Object.keys(c.env).length === 0 ? (
              <span className="text-slate-600">none</span>
            ) : (
              <ul className="space-y-1">
                {Object.entries(c.env).map(([k, v]) => (
                  <li key={k} className="break-all font-mono text-[11px]">
                    <span className="text-sky-300">{k}</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-slate-300">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </Detail>
        </div>
      )}
    </li>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
