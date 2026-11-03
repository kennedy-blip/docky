import { load as yamlLoad } from "js-yaml";

export interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  containerName?: string;
  command?: string;
  ports: string[];
  volumes: { source: string; target: string; mode?: string; named: boolean }[];
  networks: string[];
  dependsOn: { name: string; condition?: string }[];
  environment: Record<string, string>;
  healthcheck: boolean;
  replicas?: number;
  restart?: string;
  privileged?: boolean;
}

export interface ComposeModel {
  version?: string;
  services: ComposeService[];
  networks: { name: string; driver?: string; internal?: boolean }[];
  volumes: { name: string; driver?: string }[];
}

export interface Diagnostic {
  level: "error" | "warning" | "info";
  message: string;
  line?: number;
  code: string;
}

export interface ParseResult {
  model: ComposeModel | null;
  diagnostics: Diagnostic[];
  fatal: boolean;
}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));

/** Find the 1-based line of a key at a specific indentation */
export function findLine(text: string, key: string, indent?: number): number | undefined {
  const lines = text.split("\n");
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = indent === undefined ? new RegExp(`^\\s*["']?${esc}["']?\\s*:`) : new RegExp(`^ {${indent}}["']?${esc}["']?\\s*:`);
  let idx = lines.findIndex((l) => re.test(l));
  if (idx < 0 && indent !== undefined && indent > 0) {
    const loose = new RegExp(`^\\s+["']?${esc}["']?\\s*:`);
    idx = lines.findIndex((l) => loose.test(l));
  }
  return idx >= 0 ? idx + 1 : undefined;
}

function normalizePorts(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => {
    if (isObj(p)) {
      const published = str(p.published);
      const target = str(p.target);
      return `${published ? published + ":" : ""}${target ?? "?"}${p.protocol ? "/" + p.protocol : ""}`;
    }
    return String(p);
  });
}

function normalizeVolumes(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    if (isObj(raw)) {
      const source = str(raw.source) ?? "";
      return { source, target: str(raw.target) ?? "", mode: raw.read_only ? "ro" : undefined, named: raw.type === "volume" || (!!source && !/^[./~$]/.test(source) && !source.startsWith("/")) };
    }
    const parts = String(raw).split(":");
    if (parts.length === 1) return { source: "", target: parts[0], named: false };
    const source = parts[0];
    return { source, target: parts[1] ?? "", mode: parts[2], named: !/^[./~$]/.test(source) && !source.startsWith("/") };
  });
}

function normalizeNetworks(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (isObj(v)) return Object.keys(v);
  return [];
}

function normalizeDepends(v: unknown): { name: string; condition?: string }[] {
  if (Array.isArray(v)) return v.map((d) => ({ name: String(d) }));
  if (isObj(v)) return Object.entries(v).map(([name, cfg]) => ({ name, condition: isObj(cfg) ? str(cfg.condition) : undefined }));
  return [];
}

function normalizeEnv(v: unknown): Record<string, string> {
  if (Array.isArray(v)) {
    const out: Record<string, string> = {};
    v.forEach((item) => {
      const [k, ...rest] = String(item).split("=");
      out[k] = rest.join("=");
    });
    return out;
  }
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, str(val) ?? ""]));
  return {};
}

const PORT_RE = /^((\d{1,3}\.){3}\d{1,3}:)?(\d+(-\d+)?:)?\d+(-\d+)?(\/(tcp|udp))?$/;

export function parseCompose(text: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  let doc: unknown;
  try {
    doc = yamlLoad(text);
  } catch (e: unknown) {
    const err = e as { mark?: { line?: number }; reason?: string; message?: string };
    diagnostics.push({ level: "error", code: "YAML", message: `YAML syntax error: ${err.reason ?? err.message ?? "unable to parse"}`, line: err.mark?.line !== undefined ? err.mark.line + 1 : undefined });
    return { model: null, diagnostics, fatal: true };
  }

  if (!isObj(doc)) {
    diagnostics.push({ level: "error", code: "ROOT", message: "Top level must be a mapping with a `services` key." });
    return { model: null, diagnostics, fatal: true };
  }
  if (!isObj(doc.services) || Object.keys(doc.services).length === 0) {
    diagnostics.push({ level: "error", code: "NO_SERVICES", message: "`services` is missing or empty — nothing to deploy.", line: findLine(text, "services", 0) });
    return { model: null, diagnostics, fatal: true };
  }

  if (doc.version !== undefined) {
    diagnostics.push({ level: "info", code: "VERSION", message: `\`version: ${String(doc.version)}\` is obsolete in the Compose Specification and is ignored by modern Docker Compose.`, line: findLine(text, "version", 0) });
  }

  const netDefs = isObj(doc.networks) ? Object.entries(doc.networks).map(([name, cfg]) => ({ name, driver: isObj(cfg) ? str(cfg.driver) : undefined, internal: isObj(cfg) ? Boolean(cfg.internal) : false })) : [];
  const volDefs = isObj(doc.volumes) ? Object.entries(doc.volumes).map(([name, cfg]) => ({ name, driver: isObj(cfg) ? str(cfg.driver) : undefined })) : [];

  const services: ComposeService[] = Object.entries(doc.services).map(([name, raw]) => {
    const s = isObj(raw) ? raw : {};
    const deploy = isObj(s.deploy) ? s.deploy : {};
    return {
      name,
      image: str(s.image),
      build: isObj(s.build) ? str(s.build.context) ?? "." : str(s.build),
      containerName: str(s.container_name),
      command: Array.isArray(s.command) ? s.command.join(" ") : str(s.command),
      ports: normalizePorts(s.ports),
      volumes: normalizeVolumes(s.volumes),
      networks: normalizeNetworks(s.networks),
      dependsOn: normalizeDepends(s.depends_on),
      environment: normalizeEnv(s.environment),
      healthcheck: isObj(s.healthcheck),
      replicas: typeof deploy.replicas === "number" ? deploy.replicas : undefined,
      restart: str(s.restart),
      privileged: Boolean(s.privileged),
    };
  });

  const serviceNames = new Set(services.map((s) => s.name));
  const netNames = new Set(netDefs.map((n) => n.name));
  const volNames = new Set(volDefs.map((v) => v.name));
  const hostPorts = new Map<string, string>();
  const usedNets = new Set<string>();
  const usedVols = new Set<string>();

  for (const s of services) {
    const line = findLine(text, s.name, 2);
    if (!s.image && !s.build) diagnostics.push({ level: "error", code: "NO_IMAGE", message: `Service \`${s.name}\` has neither \`image\` nor \`build\`.`, line });
    if (s.image && (!s.image.includes(":") || s.image.endsWith(":latest")) && !s.image.includes("@sha256")) diagnostics.push({ level: "warning", code: "LATEST", message: `Service \`${s.name}\` uses an unpinned image \`${s.image}\` — pin a version tag for reproducible deploys.`, line });

    for (const p of s.ports) {
      if (!PORT_RE.test(p)) diagnostics.push({ level: "error", code: "PORT_FORMAT", message: `Service \`${s.name}\` has an invalid port mapping \`${p}\` (expected HOST:CONTAINER[/proto]).`, line });
      else {
        const m = p.match(/^(?:(?:\d{1,3}\.){3}\d{1,3}:)?(\d+)(?:-\d+)?:/);
        if (m) {
          const host = m[1];
          const other = hostPorts.get(host);
          if (other && other !== s.name) diagnostics.push({ level: "error", code: "PORT_CONFLICT", message: `Host port ${host} is published by both \`${other}\` and \`${s.name}\`.`, line });
          hostPorts.set(host, s.name);
        }
      }
    }

    for (const d of s.dependsOn) {
      if (!serviceNames.has(d.name)) diagnostics.push({ level: "error", code: "DEP_UNKNOWN", message: `Service \`${s.name}\` depends on unknown service \`${d.name}\`.`, line });
      else if (d.condition === "service_healthy") {
        const target = services.find((x) => x.name === d.name);
        if (target && !target.healthcheck) diagnostics.push({ level: "warning", code: "DEP_HEALTH", message: `\`${s.name}\` waits for \`${d.name}\` to be healthy, but \`${d.name}\` defines no healthcheck — it will never be considered healthy.`, line });
      }
    }

    for (const n of s.networks) {
      usedNets.add(n);
      if (!netNames.has(n) && n !== "default") diagnostics.push({ level: "error", code: "NET_UNKNOWN", message: `Service \`${s.name}\` joins undefined network \`${n}\` — declare it under top-level \`networks\`.`, line });
    }
    if (s.networks.length === 0) diagnostics.push({ level: "info", code: "NET_DEFAULT", message: `Service \`${s.name}\` has no explicit networks and will join the project's \`default\` network.`, line });

    for (const v of s.volumes) {
      if (v.named && v.source) {
        usedVols.add(v.source);
        if (!volNames.has(v.source)) diagnostics.push({ level: "error", code: "VOL_UNKNOWN", message: `Service \`${s.name}\` mounts undeclared named volume \`${v.source}\` — declare it under top-level \`volumes\`.`, line });
      }
      if (v.source === "/var/run/docker.sock") diagnostics.push({ level: "warning", code: "DOCKER_SOCK", message: `\`${s.name}\` mounts the Docker socket — this grants root-equivalent access to the host.`, line });
    }

    for (const [k, val] of Object.entries(s.environment)) {
      if (/(password|secret|token|api_?key)/i.test(k) && val && !val.startsWith("$")) diagnostics.push({ level: "warning", code: "SECRET", message: `\`${s.name}\` sets ${k} to a literal value — prefer \`\${${k}}\` interpolation, an env_file or Compose secrets.`, line });
    }

    if (s.containerName && s.replicas && s.replicas > 1) diagnostics.push({ level: "error", code: "NAME_REPLICAS", message: `\`${s.name}\` sets container_name but requests ${s.replicas} replicas — names must be unique.`, line });
    if (s.privileged) diagnostics.push({ level: "warning", code: "PRIVILEGED", message: `\`${s.name}\` runs privileged — avoid unless strictly required.`, line });
    if (!s.restart && !s.replicas) diagnostics.push({ level: "info", code: "RESTART", message: `\`${s.name}\` has no restart policy; consider \`restart: unless-stopped\` for long-running services.`, line });
  }

  // cycles
  const visiting = new Set<string>();
  const done = new Set<string>();
  const cycle: string[] = [];
  const visit = (n: string, path: string[]) => {
    if (done.has(n)) return;
    if (visiting.has(n)) {
      if (!cycle.length) cycle.push(...path.slice(path.indexOf(n)), n);
      return;
    }
    visiting.add(n);
    services.find((s) => s.name === n)?.dependsOn.forEach((d) => serviceNames.has(d.name) && visit(d.name, [...path, n]));
    visiting.delete(n);
    done.add(n);
  };
  services.forEach((s) => visit(s.name, []));
  if (cycle.length) diagnostics.push({ level: "error", code: "DEP_CYCLE", message: `Circular dependency: ${cycle.join(" → ")}.`, line: findLine(text, cycle[0], 2) });

  for (const n of netDefs) if (!usedNets.has(n.name)) diagnostics.push({ level: "warning", code: "NET_UNUSED", message: `Network \`${n.name}\` is declared but no service joins it.`, line: findLine(text, n.name, 2) });
  for (const v of volDefs) if (!usedVols.has(v.name)) diagnostics.push({ level: "warning", code: "VOL_UNUSED", message: `Volume \`${v.name}\` is declared but never mounted.`, line: findLine(text, v.name, 2) });

  const order = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => order[a.level] - order[b.level] || (a.line ?? 0) - (b.line ?? 0));

  return { model: { version: str(doc.version), services, networks: netDefs, volumes: volDefs }, diagnostics, fatal: false };
}

/* ---------- Graph layout ---------- */
export type NodeKind = "service" | "network" | "volume";
export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sub?: string;
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "depends" | "network" | "volume";
  label?: string;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function buildGraph(model: ComposeModel): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const names = new Set(model.services.map((s) => s.name));

  // depth by depends_on
  const depth = new Map<string, number>();
  const calc = (n: string, seen: Set<string>): number => {
    if (depth.has(n)) return depth.get(n)!;
    if (seen.has(n)) return 0;
    seen.add(n);
    const s = model.services.find((x) => x.name === n);
    const deps = (s?.dependsOn ?? []).filter((d) => names.has(d.name));
    const d = deps.length ? 1 + Math.max(...deps.map((x) => calc(x.name, seen))) : 0;
    depth.set(n, d);
    return d;
  };
  model.services.forEach((s) => calc(s.name, new Set()));
  const maxDepth = Math.max(0, ...Array.from(depth.values()));

  const SPACING = 190;
  const ROW = 135;
  const rows: GraphNode[][] = [];

  // networks row (includes implicit default if any service has none)
  const implicitDefault = model.services.some((s) => s.networks.length === 0);
  const netRow: GraphNode[] = model.networks.map((n) => ({ id: `net:${n.name}`, kind: "network", label: n.name, sub: n.internal ? "internal" : n.driver ?? "bridge", x: 0, y: 0, w: 140, h: 40 }));
  if (implicitDefault) netRow.push({ id: "net:default", kind: "network", label: "default", sub: "implicit", x: 0, y: 0, w: 140, h: 40 });
  if (netRow.length) rows.push(netRow);

  for (let d = maxDepth; d >= 0; d--) {
    const row = model.services
      .filter((s) => depth.get(s.name) === d)
      .map((s) => ({ id: `svc:${s.name}`, kind: "service" as const, label: s.name, sub: s.image ?? (s.build ? `build: ${s.build}` : "no image"), x: 0, y: 0, w: 164, h: 58 }));
    if (row.length) rows.push(row);
  }

  const volRow: GraphNode[] = model.volumes.map((v) => ({ id: `vol:${v.name}`, kind: "volume", label: v.name, sub: v.driver ?? "local", x: 0, y: 0, w: 130, h: 46 }));
  // bind mounts (host paths) as volume-ish nodes
  const binds = new Map<string, string>();
  model.services.forEach((s) => s.volumes.forEach((v) => !v.named && v.source && binds.set(v.source, v.source)));
  binds.forEach((b) => volRow.push({ id: `bind:${b}`, kind: "volume", label: b.length > 22 ? "…" + b.slice(-21) : b, sub: "bind mount", x: 0, y: 0, w: 150, h: 46 }));
  if (volRow.length) rows.push(volRow);

  const maxCols = Math.max(1, ...rows.map((r) => r.length));
  const width = Math.max(640, maxCols * SPACING + 80);
  rows.forEach((row, ri) => {
    const total = (row.length - 1) * SPACING;
    row.forEach((n, i) => {
      n.x = width / 2 - total / 2 + i * SPACING;
      n.y = 70 + ri * ROW;
      nodes.push(n);
    });
  });
  const height = 70 + Math.max(1, rows.length - 1) * ROW + 90;

  // edges
  model.services.forEach((s) => {
    s.dependsOn.forEach((d) => names.has(d.name) && edges.push({ id: `dep:${s.name}->${d.name}`, from: `svc:${s.name}`, to: `svc:${d.name}`, kind: "depends", label: d.condition?.replace("service_", "") }));
    (s.networks.length ? s.networks : ["default"]).forEach((n) => edges.push({ id: `net:${s.name}->${n}`, from: `svc:${s.name}`, to: `net:${n}`, kind: "network" }));
    s.volumes.forEach((v) => {
      if (v.named && v.source) edges.push({ id: `vol:${s.name}->${v.source}:${v.target}`, from: `svc:${s.name}`, to: `vol:${v.source}`, kind: "volume", label: v.target });
      else if (v.source) edges.push({ id: `bind:${s.name}->${v.source}:${v.target}`, from: `svc:${s.name}`, to: `bind:${v.source}`, kind: "volume", label: v.target });
    });
  });

  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)), width, height };
}
