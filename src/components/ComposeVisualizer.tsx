import { useMemo, useState } from "react";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { AlertTriangle, Check, CheckCircle2, Copy, Database, Download, FileJson, Info, Network, RotateCcw, Share2, Wand2, XCircle, Boxes, Layers3 } from "lucide-react";
import { composeTemplates } from "../data/mock";
import { buildGraph, parseCompose, type Diagnostic } from "../utils/compose";
import { tokenizeYaml } from "../utils/highlight";
import { Badge, Button, Card, CardHeader, Mono } from "./ui";
import { CodeEditor } from "./CodeView";
import { TopologyGraph } from "./TopologyGraph";
import { cn } from "../utils/cn";
import { useToast } from "../context/ToastContext";

export function ComposeVisualizer({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [template, setTemplate] = useState<string>("Web Stack");

  const tokens = useMemo(() => tokenizeYaml(value), [value]);
  const result = useMemo(() => parseCompose(value), [value]);
  const graph = useMemo(() => (result.model ? buildGraph(result.model) : null), [result.model]);

  const errors = result.diagnostics.filter((d) => d.level === "error");
  const warnings = result.diagnostics.filter((d) => d.level === "warning");
  const infos = result.diagnostics.filter((d) => d.level === "info");
  const errorLine = errors.find((e) => e.line)?.line ?? null;

  const selectedService = selected?.startsWith("svc:") ? result.model?.services.find((s) => `svc:${s.name}` === selected) : undefined;
  const selectedNetwork = selected?.startsWith("net:") ? selected.slice(4) : undefined;
  const selectedVolume = selected?.startsWith("vol:") ? selected.slice(4) : selected?.startsWith("bind:") ? selected.slice(5) : undefined;

  const format = () => {
    try {
      const doc = yamlLoad(value);
      const out = yamlDump(doc, { lineWidth: 120, noRefs: true });
      onChange(out);
      toast("success", "YAML formatted", "docker compose config --no-interpolate");
    } catch {
      toast("error", "Cannot format", "Fix the YAML syntax error first.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast("success", "YAML copied to clipboard");
    } catch {
      toast("error", "Clipboard unavailable");
    }
  };

  const download = () => {
    const blob = new Blob([value], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "docker-compose.yml downloaded");
  };

  const loadTemplate = (name: string) => {
    setTemplate(name);
    onChange(composeTemplates[name]);
    setSelected(null);
    toast("info", `Loaded template "${name}"`);
  };

  const publishedPorts = result.model?.services.reduce((n, s) => n + s.ports.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Template</span>
          <div className="flex gap-1 overflow-x-auto">
            {Object.keys(composeTemplates).map((t) => (
              <button
                key={t}
                onClick={() => loadTemplate(t)}
                className={cn("shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition", template === t && value === composeTemplates[t] ? "border-indigo-500/60 bg-indigo-electric/20 text-indigo-200" : "border-line-2 bg-panel-2 text-slate-400 hover:text-slate-200")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {result.fatal ? (
            <Badge tone="rose" dot>
              invalid YAML
            </Badge>
          ) : errors.length ? (
            <Badge tone="rose" dot>
              {errors.length} error{errors.length > 1 && "s"}
            </Badge>
          ) : warnings.length ? (
            <Badge tone="amber" dot>
              valid · {warnings.length} warning{warnings.length > 1 && "s"}
            </Badge>
          ) : (
            <Badge tone="green" dot pulse>
              valid
            </Badge>
          )}
          <Button size="xs" icon={<Wand2 className="h-3 w-3" />} onClick={format} disabled={result.fatal}>
            Format
          </Button>
          <Button size="xs" icon={<RotateCcw className="h-3 w-3" />} onClick={() => loadTemplate(template)}>
            Reset
          </Button>
          <Button size="xs" icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="xs" variant="primary" icon={<Download className="h-3 w-3" />} onClick={download}>
            Export YAML
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Editor */}
        <Card className="overflow-hidden xl:col-span-5">
          <CardHeader
            icon={<FileJson className="h-4 w-4" />}
            title="docker-compose.yml"
            subtitle={`${value.split("\n").length} lines · ${(new Blob([value]).size / 1024).toFixed(1)} KB`}
            actions={
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                {activeLine && <span>Ln {activeLine}</span>}
                <span className="rounded border border-line-2 px-1.5 py-0.5">YAML</span>
              </div>
            }
          />
          <CodeEditor value={value} onChange={onChange} lines={tokens} errorLine={errorLine} activeLine={activeLine} onCursorLine={setActiveLine} height="min(640px, 70vh)" placeholder="services:\n  web:\n    image: nginx:1.25-alpine" />
          <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[10px] text-slate-500">
            <span>Tab inserts 2 spaces · Enter keeps indentation</span>
            <span className={cn(errorLine ? "text-rose-400" : "text-emerald-400")}>{errorLine ? `error at line ${errorLine}` : "no syntax errors"}</span>
          </div>
        </Card>

        {/* Graph + details */}
        <div className="space-y-4 xl:col-span-7">
          <Card className="overflow-hidden">
            <CardHeader
              icon={<Share2 className="h-4 w-4" />}
              title="Service topology"
              subtitle={graph ? `${result.model!.services.length} services · ${result.model!.networks.length} networks · ${result.model!.volumes.length} volumes · ${publishedPorts} published ports` : "Fix YAML errors to render the graph"}
              actions={
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                  <Legend color="#0284c7" label="service" shape="rect" />
                  <Legend color="#6366f1" label="network" shape="pill" />
                  <Legend color="#10b981" label="volume" shape="rect" />
                  <span className="hidden items-center gap-1 sm:flex">
                    <svg width="22" height="8">
                      <line x1="0" y1="4" x2="22" y2="4" stroke="#38bdf8" strokeWidth="2" />
                    </svg>
                    depends_on
                  </span>
                </div>
              }
            />
            <div className="relative bg-ink/70">
              {graph ? (
                <TopologyGraph graph={graph} selected={selected} onSelect={setSelected} className="max-h-[520px]" />
              ) : (
                <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
                  <XCircle className="h-8 w-8 text-rose-400/70" />
                  <div className="text-sm text-slate-300">Topology unavailable</div>
                  <div className="max-w-sm font-mono text-[11px] text-rose-300/80">{errors[0]?.message}</div>
                </div>
              )}
              <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-slate-600">drag nodes · click to inspect · hover to trace links</div>
            </div>
          </Card>

          {/* Inspector */}
          {(selectedService || selectedNetwork || selectedVolume) && result.model && (
            <Card className="animate-slide-up">
              {selectedService && (
                <>
                  <CardHeader
                    icon={<Boxes className="h-4 w-4" />}
                    title={<span className="font-mono">{selectedService.name}</span>}
                    subtitle={selectedService.image ?? (selectedService.build ? `build: ${selectedService.build}` : "no image")}
                    actions={
                      <div className="flex gap-1.5">
                        {selectedService.healthcheck && <Badge tone="green">healthcheck</Badge>}
                        {selectedService.restart && <Badge tone="slate">restart: {selectedService.restart}</Badge>}
                        {selectedService.replicas && <Badge tone="indigo">×{selectedService.replicas}</Badge>}
                        <button onClick={() => setSelected(null)} className="text-[11px] text-slate-500 hover:text-white">
                          close
                        </button>
                      </div>
                    }
                  />
                  <div className="grid grid-cols-1 gap-4 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <Block title="Ports">
                      {selectedService.ports.length ? selectedService.ports.map((p) => <Mono key={p}>{p}</Mono>) : <span className="text-slate-600">none</span>}
                    </Block>
                    <Block title="Networks">
                      {(selectedService.networks.length ? selectedService.networks : ["default"]).map((n) => (
                        <Badge key={n} tone="indigo">
                          {n}
                        </Badge>
                      ))}
                    </Block>
                    <Block title="Depends on">
                      {selectedService.dependsOn.length ? (
                        selectedService.dependsOn.map((d) => (
                          <Badge key={d.name} tone="blue">
                            {d.name}
                            {d.condition && <span className="opacity-60">· {d.condition.replace("service_", "")}</span>}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-600">none</span>
                      )}
                    </Block>
                    <Block title="Volumes">
                      {selectedService.volumes.length ? (
                        selectedService.volumes.map((v, i) => (
                          <div key={i} className="font-mono text-[11px] text-emerald-300/90">
                            {v.source || "(anon)"}
                            <span className="text-slate-500"> → </span>
                            {v.target}
                            {v.mode && <span className="text-slate-500">:{v.mode}</span>}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-600">none</span>
                      )}
                    </Block>
                    <Block title="Environment" className="sm:col-span-2 lg:col-span-3">
                      {Object.keys(selectedService.environment).length ? (
                        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                          {Object.entries(selectedService.environment).map(([k, v]) => (
                            <div key={k} className="truncate font-mono text-[11px]">
                              <span className="text-sky-300">{k}</span>
                              <span className="text-slate-500">=</span>
                              <span className="text-slate-300">{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">none</span>
                      )}
                    </Block>
                    <Block title="Command">{selectedService.command ? <Mono className="break-all">{selectedService.command}</Mono> : <span className="text-slate-600">image default</span>}</Block>
                  </div>
                </>
              )}
              {selectedNetwork && (
                <>
                  <CardHeader icon={<Network className="h-4 w-4" />} title={<span className="font-mono">{selectedNetwork}</span>} subtitle={`network · ${result.model.networks.find((n) => n.name === selectedNetwork)?.driver ?? "bridge"}${result.model.networks.find((n) => n.name === selectedNetwork)?.internal ? " · internal (no egress)" : ""}`} actions={<button onClick={() => setSelected(null)} className="text-[11px] text-slate-500 hover:text-white">close</button>} />
                  <div className="p-4 text-xs">
                    <Block title="Attached services">
                      {result.model.services
                        .filter((s) => (s.networks.length ? s.networks : ["default"]).includes(selectedNetwork))
                        .map((s) => (
                          <button key={s.name} onClick={() => setSelected(`svc:${s.name}`)}>
                            <Badge tone="blue">{s.name}</Badge>
                          </button>
                        ))}
                    </Block>
                    <p className="mt-3 text-[11px] text-slate-500">Services on the same network resolve each other by service name via Docker's embedded DNS (127.0.0.11).</p>
                  </div>
                </>
              )}
              {selectedVolume && (
                <>
                  <CardHeader icon={<Database className="h-4 w-4" />} title={<span className="font-mono">{selectedVolume}</span>} subtitle={selected?.startsWith("bind:") ? "bind mount · host path" : `named volume · ${result.model.volumes.find((v) => v.name === selectedVolume)?.driver ?? "local"} driver`} actions={<button onClick={() => setSelected(null)} className="text-[11px] text-slate-500 hover:text-white">close</button>} />
                  <div className="p-4 text-xs">
                    <Block title="Mounted by">
                      {result.model.services
                        .filter((s) => s.volumes.some((v) => v.source === selectedVolume))
                        .map((s) => (
                          <div key={s.name} className="flex items-center gap-2">
                            <button onClick={() => setSelected(`svc:${s.name}`)}>
                              <Badge tone="blue">{s.name}</Badge>
                            </button>
                            <span className="font-mono text-[11px] text-emerald-300/90">{s.volumes.filter((v) => v.source === selectedVolume).map((v) => v.target + (v.mode ? `:${v.mode}` : "")).join(", ")}</span>
                          </div>
                        ))}
                    </Block>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Diagnostics */}
          <Card>
            <CardHeader
              icon={<Layers3 className="h-4 w-4" />}
              title="Validation"
              subtitle={`${errors.length} errors · ${warnings.length} warnings · ${infos.length} hints`}
              actions={
                !result.fatal && errors.length === 0 ? (
                  <Badge tone="green" dot>
                    docker compose config: OK
                  </Badge>
                ) : (
                  <Badge tone="rose" dot>
                    deploy blocked
                  </Badge>
                )
              }
            />
            {result.diagnostics.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> No issues found. This compose file follows best practices.
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-auto">
                {result.diagnostics.map((d, i) => (
                  <DiagRow key={i} d={d} onJump={() => d.line && setActiveLine(d.line)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, shape }: { color: string; label: string; shape: "rect" | "pill" }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-4 border", shape === "pill" ? "rounded-full" : "rounded-sm")} style={{ borderColor: color, background: color + "33" }} />
      {label}
    </span>
  );
}

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function DiagRow({ d, onJump }: { d: Diagnostic; onJump: () => void }) {
  const icon = d.level === "error" ? <XCircle className="h-4 w-4 text-rose-400" /> : d.level === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <Info className="h-4 w-4 text-sky-400" />;
  return (
    <li>
      <button onClick={onJump} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-slate-800/40 sm:px-5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs leading-relaxed text-slate-200" dangerouslySetInnerHTML={{ __html: escapeHtml(d.message).replace(/`([^`]+)`/g, '<code class="font-mono text-sky-300">$1</code>') }} />
          <span className="font-mono text-[10px] text-slate-500">
            {d.code}
            {d.line ? ` · line ${d.line}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
