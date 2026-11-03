import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, BadgeCheck, Check, Copy, Cpu, Download, Play, Search, ShieldCheck, Star, Tag, X, Clock, Filter, ArrowUpDown } from "lucide-react";
import type { RegistryImage, RegistryTag } from "../types";
import type { FleetApi } from "../hooks/useFleet";
import { formatSize } from "../hooks/useFleet";
import { registryCatalog } from "../data/mock";
import { Badge, Button, Card, CardHeader, Empty, Modal, inputCls } from "./ui";
import { cn } from "../utils/cn";
import { useToast } from "../context/ToastContext";

type Filter = "all" | "official" | "verified";
type Sort = "relevance" | "stars" | "updated";

interface PullState {
  pct: number;
  layers: { id: string; pct: number }[];
  done: boolean;
}

const pullsToNumber = (s: string) => (s.includes("B") ? 1e9 : s.includes("M") ? parseInt(s) * 1e6 : parseInt(s) * 1e3);

export function RegistrySearch({ fleet }: { fleet: FleetApi }) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("relevance");
  const [open, setOpen] = useState<RegistryImage | null>(null);
  const [pulls, setPulls] = useState<Record<string, PullState>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const timers = useRef<number[]>([]);
  const progressRef = useRef<Record<string, PullState>>({});

  // debounce
  useEffect(() => {
    setSearching(true);
    const t = window.setTimeout(() => {
      setQuery(raw.trim().toLowerCase());
      setSearching(false);
    }, 280);
    return () => window.clearTimeout(t);
  }, [raw]);

  useEffect(() => () => timers.current.forEach((t) => window.clearInterval(t)), []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(registryCatalog.map((r) => r.category))).sort()], []);

  const results = useMemo(() => {
    let list = registryCatalog.filter((r) => {
      if (filter === "official" && !r.official) return false;
      if (filter === "verified" && !r.verified) return false;
      if (category !== "All" && r.category !== category) return false;
      if (!query) return true;
      return r.name.toLowerCase().includes(query) || r.description.toLowerCase().includes(query) || r.publisher.toLowerCase().includes(query) || r.tags.some((t) => t.name.includes(query));
    });
    const score = (r: RegistryImage) => (query ? (r.name.toLowerCase() === query ? 3 : r.name.toLowerCase().startsWith(query) ? 2 : r.name.toLowerCase().includes(query) ? 1 : 0) : 0);
    if (sort === "stars") list = [...list].sort((a, b) => b.stars - a.stars);
    else if (sort === "updated") list = [...list].sort((a, b) => pullsToNumber(b.pulls) - pullsToNumber(a.pulls));
    else list = [...list].sort((a, b) => score(b) - score(a) || b.stars - a.stars);
    return list;
  }, [query, filter, category, sort]);

  const copyCmd = async (key: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
      toast("success", "Copied", cmd);
    } catch {
      toast("error", "Clipboard unavailable");
    }
  };

  const startPull = (img: RegistryImage, tag: RegistryTag) => {
    const key = `${img.name}:${tag.name}`;
    if (pulls[key] && !pulls[key].done) return;
    if (fleet.hasImage(img.name, tag.name)) {
      toast("info", `${key} already exists locally`, "Status: Image is up to date");
      return;
    }
    const layerCount = Math.max(3, Math.min(9, Math.round(tag.sizeMb / 60) + 3));
    const layers = Array.from({ length: layerCount }, () => ({ id: Math.random().toString(16).slice(2, 14), pct: 0 }));
    progressRef.current = { ...progressRef.current, [key]: { pct: 0, layers, done: false } };
    setPulls(progressRef.current);
    toast("info", `Pulling ${key}`, `${layerCount} layers · ${formatSize(tag.sizeMb)}`);
    const t = window.setInterval(() => {
      const cur = progressRef.current[key];
      if (!cur || cur.done) {
        window.clearInterval(t);
        return;
      }
      // Docker downloads up to 3 layers concurrently; later layers start once an earlier one is underway
      const nextLayers = cur.layers.map((l, i) => {
        const unlocked = i < 3 || cur.layers[i - 1].pct > 20;
        const inc = unlocked ? Math.random() * Math.max(8, 30 - i * 2) : 0;
        return { ...l, pct: Math.min(100, l.pct + inc) };
      });
      const pct = nextLayers.reduce((s, l) => s + l.pct, 0) / nextLayers.length;
      const done = pct >= 99.5;
      progressRef.current = {
        ...progressRef.current,
        [key]: done ? { pct: 100, layers: nextLayers.map((l) => ({ ...l, pct: 100 })), done: true } : { ...cur, layers: nextLayers, pct },
      };
      setPulls(progressRef.current);
      if (done) {
        window.clearInterval(t);
        fleet.pullImage(img.name, tag.name, tag.sizeMb);
        toast("success", `Pulled ${key}`, `Digest: sha256:${Math.random().toString(16).slice(2, 14)}… · Status: Downloaded newer image`);
      }
    }, 380);
    timers.current.push(t);
  };

  const run = (img: RegistryImage, tag: RegistryTag) => {
    const c = fleet.runFromImage(img.name, tag.name);
    toast("success", `Container ${c.name} started`, `docker run -d --name ${c.name} ${img.name}:${tag.name}`);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className={cn("pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500", searching && "animate-pulse text-sky-400")} />
            <input value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Search Docker Hub — e.g. postgres, nginx, python:3.11-slim…" className={cn(inputCls, "h-11 pl-10 pr-10 text-sm")} autoFocus />
            {raw && (
              <button onClick={() => setRaw("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            {(
              [
                { id: "all", label: "All" },
                { id: "official", label: "Official" },
                { id: "verified", label: "Verified publisher" },
              ] as { id: Filter; label: string }[]
            ).map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={cn("rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition", filter === f.id ? "border-indigo-500/60 bg-indigo-electric/20 text-indigo-200" : "border-line-2 bg-panel-2 text-slate-400 hover:text-slate-200")}>
                {f.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line-2" />
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(inputCls, "h-8 w-auto py-1 text-[11px]")}>
              <option value="relevance">Relevance</option>
              <option value="stars">Most stars</option>
              <option value="updated">Most pulls</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={cn("rounded-full border px-2.5 py-0.5 text-[11px] transition", category === c ? "border-cyber/60 bg-cyber/15 text-sky-200" : "border-line text-slate-500 hover:border-line-2 hover:text-slate-300")}>
              {c}
            </button>
          ))}
        </div>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-400">
          <span className="font-mono text-slate-200">{results.length}</span> result{results.length === 1 ? "" : "s"}
          {query && (
            <>
              {" "}
              for <span className="font-mono text-sky-300">"{query}"</span>
            </>
          )}
        </span>
        <span className="font-mono text-[10px] text-slate-600">registry-1.docker.io · hub.docker.com/v2/search</span>
      </div>

      {results.length === 0 ? (
        <Card>
          <Empty icon={<Search className="h-5 w-5" />} title="No images found" description={`Nothing in the catalog matches "${query}". Try a shorter term or clear the filters.`} action={<Button size="xs" onClick={() => { setRaw(""); setFilter("all"); setCategory("All"); }}>Clear</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {results.map((r) => {
            const local = r.tags.filter((t) => fleet.hasImage(r.name, t.name)).length;
            const pulling = r.tags.some((t) => pulls[`${r.name}:${t.name}`] && !pulls[`${r.name}:${t.name}`].done);
            return (
              <Card key={r.name} className="group flex flex-col transition hover:border-line-2 hover:shadow-[0_0_0_1px_rgba(2,132,199,0.25),0_16px_40px_-24px_rgba(2,132,199,0.6)]">
                <button onClick={() => setOpen(r)} className="flex flex-1 flex-col items-start gap-2 p-4 text-left">
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-mono text-sm font-semibold text-slate-100">{r.name}</span>
                        {r.official && (
                          <Badge tone="blue">
                            <ShieldCheck className="h-3 w-3" /> Official
                          </Badge>
                        )}
                        {!r.official && r.verified && (
                          <Badge tone="indigo">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">by {r.publisher}</div>
                    </div>
                    <span className="shrink-0 rounded-md border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] text-slate-400">{r.category}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">{r.description}</p>
                  <div className="mt-auto flex w-full flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400" /> {r.stars.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3 text-sky-400" /> {r.pulls}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-slate-500" /> {r.tags.length} tags
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3" /> {r.updated}
                    </span>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                  <code className="truncate font-mono text-[11px] text-slate-500">
                    docker pull {r.name}:{r.tags[0].name}
                  </code>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {local > 0 && <Badge tone="green">{local} local</Badge>}
                    {pulling && (
                      <Badge tone="amber" dot pulse>
                        pulling
                      </Badge>
                    )}
                    <Button size="xs" variant="outline" icon={<ArrowDownToLine className="h-3 w-3" />} onClick={() => startPull(r, r.tags[0])} disabled={pulling}>
                      Pull
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        size="lg"
        icon={<Cpu className="h-4 w-4" />}
        title={
          open && (
            <span className="flex items-center gap-2">
              <span className="font-mono">{open.name}</span>
              {open.official && (
                <Badge tone="blue">
                  <ShieldCheck className="h-3 w-3" /> Official Image
                </Badge>
              )}
              {!open.official && open.verified && (
                <Badge tone="indigo">
                  <BadgeCheck className="h-3 w-3" /> Verified Publisher
                </Badge>
              )}
            </span>
          )
        }
        subtitle={open ? `${open.publisher} · ${open.stars.toLocaleString()} stars · ${open.pulls} pulls` : ""}
      >
        {open && (
          <div className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-slate-300">{open.description}</p>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs text-sky-200">docker pull {open.name}</code>
              <Button size="xs" variant="ghost" icon={copiedKey === "main" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} onClick={() => copyCmd("main", `docker pull ${open.name}`)}>
                {copiedKey === "main" ? "Copied" : "Copy"}
              </Button>
            </div>
            <Card>
              <CardHeader icon={<Tag className="h-4 w-4" />} title="Tags" subtitle={`${open.tags.length} tags · multi-arch manifests`} />
              <ul className="divide-y divide-line">
                {open.tags.map((t) => {
                  const key = `${open.name}:${t.name}`;
                  const ps = pulls[key];
                  const local = fleet.hasImage(open.name, t.name);
                  return (
                    <li key={t.name} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="font-mono text-sm text-slate-100">
                              {open.name}
                              <span className="text-slate-500">:</span>
                              <span className="text-sky-300">{t.name}</span>
                            </code>
                            {local && <Badge tone="green">local</Badge>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-500">
                            <span>{formatSize(t.sizeMb)} compressed</span>
                            <span>{t.arch.join(" · ")}</span>
                            <span>{t.updated}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="xs" variant="ghost" icon={copiedKey === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} onClick={() => copyCmd(key, `docker pull ${key}`)} title="Copy pull command" />
                          {local ? (
                            <Button size="xs" variant="success" icon={<Play className="h-3 w-3" />} onClick={() => run(open, t)}>
                              Run
                            </Button>
                          ) : (
                            <Button size="xs" variant="primary" icon={<ArrowDownToLine className="h-3 w-3" />} onClick={() => startPull(open, t)} disabled={!!ps && !ps.done}>
                              {ps && !ps.done ? `${Math.round(ps.pct)}%` : "Pull"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {ps && !ps.done && (
                        <div className="mt-3 space-y-1 rounded-lg border border-line bg-ink p-3 font-mono text-[10px]">
                          {ps.layers.map((l) => (
                            <div key={l.id} className="flex items-center gap-2">
                              <span className="w-24 shrink-0 text-slate-500">{l.id}:</span>
                              <span className="w-24 shrink-0 text-slate-400">{l.pct >= 100 ? "Pull complete" : l.pct > 0 ? "Downloading" : "Waiting"}</span>
                              <div className="h-1 flex-1 overflow-hidden rounded bg-slate-800">
                                <div className="h-full bg-gradient-to-r from-cyber to-sky-400 transition-all duration-300" style={{ width: `${l.pct}%` }} />
                              </div>
                              <span className="w-10 text-right text-slate-400">{Math.round(l.pct)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
