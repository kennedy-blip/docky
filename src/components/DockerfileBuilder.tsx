import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, FileCode2, FolderCog, HardDrive, Layers, Package, Plus, Rocket, ShieldCheck, Trash2, XCircle, Box } from "lucide-react";
import type { BaseImageId, DockerfileConfig } from "../types";
import { basePresets, baseImageRef, defaultConfig, estimateSize, generateDockerfile, lintConfig, scoreConfig } from "../utils/dockerfile";
import { tokenizeDockerfile } from "../utils/highlight";
import { formatSize } from "../hooks/useFleet";
import { Badge, Button, Card, CardHeader, Field, Toggle, inputCls } from "./ui";
import { CodeBlock } from "./CodeView";
import { cn } from "../utils/cn";
import { useToast } from "../context/ToastContext";

const steps = [
  { id: 0, label: "Base image", icon: <Box className="h-4 w-4" /> },
  { id: 1, label: "Workdir & build mode", icon: <FolderCog className="h-4 w-4" /> },
  { id: 2, label: "Dependencies", icon: <Package className="h-4 w-4" /> },
  { id: 3, label: "Runtime & security", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 4, label: "CMD / ENTRYPOINT", icon: <Rocket className="h-4 w-4" /> },
];

const installPresets: Record<BaseImageId, string[]> = {
  node20: ["npm ci --omit=dev", "npm ci", "pnpm install --frozen-lockfile --prod", "yarn install --frozen-lockfile --production"],
  python311: ["pip install --no-cache-dir -r requirements.txt", "pip install --no-cache-dir poetry && poetry install --no-root --only main", "pip install --no-cache-dir -e ."],
  rust: ["cargo fetch", "cargo chef cook --release --recipe-path recipe.json"],
  go: ["go mod download", "go mod download && go mod verify"],
  custom: ["apk add --no-cache curl", "apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*"],
};

export function DockerfileBuilder() {
  const [cfg, setCfg] = useState<DockerfileConfig>(() => defaultConfig("node20"));
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [portInput, setPortInput] = useState("");
  const { toast } = useToast();

  const dockerfile = useMemo(() => generateDockerfile(cfg), [cfg]);
  const tokens = useMemo(() => tokenizeDockerfile(dockerfile), [dockerfile]);
  const lint = useMemo(() => lintConfig(cfg), [cfg]);
  const score = scoreConfig(lint);
  const size = estimateSize(cfg);
  const layers = dockerfile.split("\n").filter((l) => /^(FROM|RUN|COPY|ADD)\b/.test(l)).length;
  const preset = basePresets[cfg.base];

  const set = <K extends keyof DockerfileConfig>(k: K, v: DockerfileConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const changeBase = (b: BaseImageId) => {
    setCfg((c) => defaultConfig(b, c));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dockerfile);
      setCopied(true);
      toast("success", "Dockerfile copied to clipboard", `${dockerfile.split("\n").length} lines · ${preset.label}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("error", "Clipboard unavailable", "Select the text and copy manually.");
    }
  };

  const download = () => {
    const blob = new Blob([dockerfile], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Dockerfile";
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Dockerfile downloaded");
  };

  const addPort = () => {
    const n = parseInt(portInput, 10);
    if (!n || n < 1 || n > 65535) return toast("error", "Invalid port", "Enter a number between 1 and 65535");
    if (cfg.ports.includes(n)) return setPortInput("");
    set("ports", [...cfg.ports, n]);
    setPortInput("");
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* ---------------- Left: configurator ---------------- */}
      <div className="space-y-4 xl:col-span-5">
        {/* Stepper */}
        <Card className="p-3">
          <ol className="flex items-center gap-1 overflow-x-auto">
            {steps.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.id} className="flex shrink-0 items-center">
                  <button
                    onClick={() => setStep(i)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                      active ? "bg-indigo-electric/20 text-indigo-200 ring-1 ring-indigo-500/50" : done ? "text-emerald-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
                    )}
                  >
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]", active ? "bg-indigo-electric text-white" : done ? "bg-emerald-neon/20 text-emerald-300" : "bg-slate-800 text-slate-500")}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                  {i < steps.length - 1 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-slate-700" />}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card>
          <CardHeader icon={steps[step].icon} title={`Step ${step + 1} · ${steps[step].label}`} subtitle={stepSubtitle(step)} />
          <div className="space-y-4 p-4 sm:p-5">
            {/* STEP 0: base image */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(basePresets) as BaseImageId[]).map((id) => {
                    const p = basePresets[id];
                    const active = cfg.base === id;
                    return (
                      <button
                        key={id}
                        onClick={() => changeBase(id)}
                        className={cn(
                          "group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                          active ? "border-indigo-500/60 bg-indigo-electric/10 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]" : "border-line bg-panel-2/50 hover:border-line-2 hover:bg-panel-2",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                          <span className="text-sm font-semibold text-slate-100">{p.label}</span>
                        </span>
                        <span className="text-[11px] text-slate-500">{p.tagline}</span>
                        {id !== "custom" && <span className="mt-1 font-mono text-[10px] text-sky-300/80">{p.repo}:{p.variants[0].tag}</span>}
                      </button>
                    );
                  })}
                </div>

                {cfg.base === "custom" ? (
                  <Field label="Image reference" hint="repository:tag or @sha256 digest">
                    <input value={cfg.customImage} onChange={(e) => set("customImage", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="ubuntu:22.04" />
                  </Field>
                ) : (
                  <Field label="Variant / tag" hint={`${preset.variants.length} options`}>
                    <div className="flex flex-wrap gap-2">
                      {preset.variants.map((v) => (
                        <button
                          key={v.tag}
                          onClick={() => set("variant", v.tag)}
                          className={cn(
                            "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition",
                            cfg.variant === v.tag ? "border-cyber/60 bg-cyber/10" : "border-line bg-panel-2/50 hover:border-line-2",
                          )}
                        >
                          <span className="font-mono text-xs text-sky-200">{v.tag}</span>
                          <span className="text-[10px] text-slate-500">
                            {formatSize(v.sizeMb)} · {v.note}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <div className="rounded-lg border border-line bg-ink/60 p-3 font-mono text-xs">
                  <span className="tok-instr">FROM</span> <span className="text-slate-100">{baseImageRef(cfg)}</span>
                </div>
              </>
            )}

            {/* STEP 1: workdir & mode */}
            {step === 1 && (
              <>
                <Field label="WORKDIR" hint="absolute path inside the image">
                  <input value={cfg.workdir} onChange={(e) => set("workdir", e.target.value)} className={cn(inputCls, "font-mono")} />
                </Field>
                <Toggle checked={cfg.multiStage} onChange={(v) => set("multiStage", v)} label="Multi-stage build" description={cfg.multiStage ? `builder → ${preset.runtimeImage.image}` : "single FROM, toolchain stays in final image"} />
                <Toggle checked={cfg.cacheMounts} onChange={(v) => set("cacheMounts", v)} label="BuildKit cache mounts" description={`--mount=type=cache,target=${preset.cachePath}`} />
                <Toggle checked={cfg.labels} onChange={(v) => set("labels", v)} label="OCI image labels" description="org.opencontainers.image.* metadata" />
              </>
            )}

            {/* STEP 2: deps */}
            {step === 2 && (
              <>
                <Toggle checked={cfg.copyManifestsFirst} onChange={(v) => set("copyManifestsFirst", v)} label="Copy manifests before source" description={`COPY ${preset.manifests} ./ → install → COPY . .`} />
                <Field label="Install command" hint="runs after manifests are copied">
                  <input value={cfg.installCmd} onChange={(e) => set("installCmd", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="npm ci" />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  {installPresets[cfg.base].map((p) => (
                    <button key={p} onClick={() => set("installCmd", p)} className={cn("rounded border px-2 py-1 font-mono text-[10px] transition", cfg.installCmd === p ? "border-cyber/60 bg-cyber/10 text-sky-200" : "border-line-2 bg-panel-2 text-slate-400 hover:text-slate-200")}>
                      {p}
                    </button>
                  ))}
                </div>
                <Field label="Build command" hint="optional · leave blank to skip">
                  <input value={cfg.buildCmd} onChange={(e) => set("buildCmd", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="npm run build" />
                </Field>
              </>
            )}

            {/* STEP 3: runtime */}
            {step === 3 && (
              <>
                <Field label="EXPOSE ports">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cfg.ports.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-md border border-cyber/40 bg-cyber/10 px-2 py-1 font-mono text-xs text-sky-200">
                        {p}
                        <button onClick={() => set("ports", cfg.ports.filter((x) => x !== p))} className="text-sky-400/70 hover:text-white" aria-label={`Remove port ${p}`}>
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={portInput}
                        onChange={(e) => setPortInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addPort()}
                        placeholder="8080"
                        className={cn(inputCls, "h-8 w-24 py-1 font-mono text-xs")}
                      />
                      <Button size="xs" onClick={addPort} icon={<Plus className="h-3 w-3" />}>
                        Add
                      </Button>
                    </div>
                  </div>
                </Field>

                <Field label="ENV variables" hint={`${cfg.env.length} defined`}>
                  <div className="space-y-2">
                    {cfg.env.map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={e.key}
                          onChange={(ev) => set("env", cfg.env.map((x, j) => (j === i ? { ...x, key: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") } : x)))}
                          placeholder="KEY"
                          className={cn(inputCls, "h-8 flex-1 py-1 font-mono text-xs text-sky-200")}
                        />
                        <span className="text-slate-600">=</span>
                        <input value={e.value} onChange={(ev) => set("env", cfg.env.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} placeholder="value" className={cn(inputCls, "h-8 flex-1 py-1 font-mono text-xs")} />
                        <button onClick={() => set("env", cfg.env.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Remove env">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button size="xs" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={() => set("env", [...cfg.env, { key: "", value: "" }])}>
                      Add variable
                    </Button>
                  </div>
                </Field>

                <Toggle checked={cfg.nonRoot} onChange={(v) => set("nonRoot", v)} label="Run as non-root user" description={`USER ${cfg.multiStage ? preset.userName : preset.singleUser}`} />
                <Toggle checked={cfg.healthcheck} onChange={(v) => set("healthcheck", v)} label="HEALTHCHECK" description="interval 30s · timeout 5s · retries 3" />
                {cfg.healthcheck && (
                  <Field label="Healthcheck command">
                    <input value={cfg.healthcheckCmd} onChange={(e) => set("healthcheckCmd", e.target.value)} className={cn(inputCls, "font-mono text-xs")} />
                  </Field>
                )}
              </>
            )}

            {/* STEP 4: process */}
            {step === 4 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "cmd", label: "CMD only", desc: "easy to override" },
                      { id: "entrypoint", label: "ENTRYPOINT", desc: "fixed executable" },
                      { id: "both", label: "Both", desc: "exe + default args" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set("runtimeMode", m.id)}
                      className={cn("rounded-lg border p-3 text-left transition", cfg.runtimeMode === m.id ? "border-indigo-500/60 bg-indigo-electric/10" : "border-line bg-panel-2/50 hover:border-line-2")}
                    >
                      <div className="font-mono text-xs font-semibold text-slate-100">{m.label}</div>
                      <div className="text-[10px] text-slate-500">{m.desc}</div>
                    </button>
                  ))}
                </div>
                {(cfg.runtimeMode === "entrypoint" || cfg.runtimeMode === "both") && (
                  <Field label="ENTRYPOINT" hint="exec form (JSON array) is generated">
                    <input value={cfg.entrypoint} onChange={(e) => set("entrypoint", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="/usr/local/bin/app" />
                  </Field>
                )}
                {(cfg.runtimeMode === "cmd" || cfg.runtimeMode === "both") && (
                  <Field label="CMD" hint={cfg.runtimeMode === "both" ? "default arguments" : "process to run"}>
                    <input value={cfg.cmd} onChange={(e) => set("cmd", e.target.value)} className={cn(inputCls, "font-mono")} placeholder="node dist/server.js" />
                  </Field>
                )}
                <div className="rounded-lg border border-line bg-ink/60 p-3 text-[11px] leading-relaxed text-slate-400">
                  <strong className="text-slate-200">Tip:</strong> exec form (<code className="font-mono text-sky-300">["node", "server.js"]</code>) makes your process PID 1 so it receives <code className="font-mono text-amber-300">SIGTERM</code> directly. Shell form wraps it in <code className="font-mono">/bin/sh -c</code> and swallows signals.
                </div>
              </>
            )}

            {/* nav */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <Button variant="ghost" size="sm" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Back
              </Button>
              <span className="font-mono text-[11px] text-slate-500">
                {step + 1} / {steps.length}
              </span>
              {step < steps.length - 1 ? (
                <Button variant="primary" size="sm" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copy}>
                  {copied ? "Copied" : "Copy Dockerfile"}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Lint */}
        <Card>
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Best-practice analysis"
            subtitle={`${lint.filter((l) => l.level === "ok").length} passed · ${lint.filter((l) => l.level === "warn").length} warnings · ${lint.filter((l) => l.level === "error").length} errors`}
            actions={<ScoreRing score={score} />}
          />
          <ul className="divide-y divide-line">
            {lint.map((l, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                <span className="mt-0.5 shrink-0">
                  {l.level === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : l.level === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200">{l.title}</div>
                  <div className="text-[11px] leading-relaxed text-slate-500">{l.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---------------- Right: preview ---------------- */}
      <div className="space-y-4 xl:col-span-7">
        <Card className="overflow-hidden xl:sticky xl:top-[118px]">
          <CardHeader
            icon={<FileCode2 className="h-4 w-4" />}
            title={
              <span className="flex items-center gap-2">
                Dockerfile <Badge tone="indigo">{preset.label}</Badge>
                {cfg.multiStage && <Badge tone="blue">multi-stage</Badge>}
              </span>
            }
            subtitle={<span className="font-mono">docker build -t my-service:1.0.0 .</span>}
            actions={
              <>
                <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={download}>
                  Download
                </Button>
                <Button size="sm" variant="primary" icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={copy}>
                  {copied ? "Copied!" : "Copy Dockerfile"}
                </Button>
              </>
            }
          />
          <div className="grid grid-cols-3 divide-x divide-line border-b border-line bg-panel-2/40 text-center">
            <Stat icon={<Layers className="h-3.5 w-3.5" />} label="Layers" value={String(layers)} />
            <Stat icon={<HardDrive className="h-3.5 w-3.5" />} label="Est. size" value={formatSize(size)} tone={size > 600 ? "text-rose-300" : size > 300 ? "text-amber-300" : "text-emerald-300"} />
            <Stat icon={<FileCode2 className="h-3.5 w-3.5" />} label="Lines" value={String(dockerfile.trimEnd().split("\n").length)} />
          </div>
          <CodeBlock lines={tokens} maxHeight="calc(100vh - 290px)" className="min-h-[320px] py-3" />
        </Card>
      </div>
    </div>
  );
}

function stepSubtitle(step: number) {
  return ["Choose a runtime and a pinned tag", "Where your code lives and how it's built", "Package manager and build commands", "Ports, env, user and healthcheck", "How the container process starts"][step];
}

function Stat({ icon, label, value, tone = "text-slate-100" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className={cn("font-mono text-sm font-semibold", tone)}>{value}</div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative flex h-10 w-10 items-center justify-center" title="Best-practice score">
      <svg width="40" height="40" viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} stroke="#1f2937" strokeWidth="4" fill="none" />
        <circle cx="20" cy="20" r={r} stroke={color} strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="relative font-mono text-[11px] font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
