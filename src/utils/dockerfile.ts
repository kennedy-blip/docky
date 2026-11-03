import type { BaseImageId, DockerfileConfig } from "../types";

export interface BasePreset {
  id: BaseImageId;
  label: string;
  tagline: string;
  repo: string;
  variants: { tag: string; sizeMb: number; note: string }[];
  runtimeImage: { image: string; sizeMb: number };
  workdir: string;
  manifests: string;
  installCmd: string;
  builderInstallCmd: string;
  buildCmd: string;
  cmd: string;
  entrypoint: string;
  port: number;
  cachePath: string;
  userName: string; // user in the (multi-stage) runtime image
  singleUser: string; // user in a single-stage build
  userSetup: string[]; // commands to create user (empty if user exists in image)
  runtimeUserSetup: string[]; // for runtime image in multi-stage
  healthcheckCmd: string;
  artifactsMb: number;
  copyArtifacts: (workdir: string, user: string, chown: boolean) => string[];
  prunePostBuild?: string;
  color: string;
}

export const basePresets: Record<BaseImageId, BasePreset> = {
  node20: {
    id: "node20",
    label: "Node.js 20",
    tagline: "LTS · npm · TypeScript friendly",
    repo: "node",
    variants: [
      { tag: "20-alpine", sizeMb: 181, note: "musl · smallest" },
      { tag: "20-bookworm-slim", sizeMb: 220, note: "glibc · recommended" },
      { tag: "20-bookworm", sizeMb: 1120, note: "full toolchain" },
    ],
    runtimeImage: { image: "node:20-alpine", sizeMb: 181 },
    workdir: "/app",
    manifests: "package*.json",
    installCmd: "npm ci --omit=dev",
    builderInstallCmd: "npm ci",
    buildCmd: "npm run build",
    cmd: "node dist/server.js",
    entrypoint: "node",
    port: 3000,
    cachePath: "/root/.npm",
    userName: "node",
    singleUser: "node",
    userSetup: [],
    runtimeUserSetup: [],
    healthcheckCmd: "wget -qO- http://localhost:3000/healthz || exit 1",
    artifactsMb: 64,
    prunePostBuild: "npm prune --omit=dev",
    copyArtifacts: (wd, user, chown) => {
      const c = chown ? ` --chown=${user}:${user}` : "";
      return [`COPY --from=builder${c} ${wd}/package*.json ./`, `COPY --from=builder${c} ${wd}/node_modules ./node_modules`, `COPY --from=builder${c} ${wd}/dist ./dist`];
    },
    color: "#84cc16",
  },
  python311: {
    id: "python311",
    label: "Python 3.11",
    tagline: "pip · FastAPI / Django ready",
    repo: "python",
    variants: [
      { tag: "3.11-slim", sizeMb: 131, note: "debian slim · recommended" },
      { tag: "3.11-alpine", sizeMb: 52, note: "musl · wheels may compile" },
      { tag: "3.11-bookworm", sizeMb: 1010, note: "full toolchain" },
    ],
    runtimeImage: { image: "python:3.11-slim", sizeMb: 131 },
    workdir: "/app",
    manifests: "requirements.txt",
    installCmd: "pip install --no-cache-dir -r requirements.txt",
    builderInstallCmd: "pip install --no-cache-dir --prefix=/install -r requirements.txt",
    buildCmd: "",
    cmd: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
    entrypoint: "python",
    port: 8000,
    cachePath: "/root/.cache/pip",
    userName: "app",
    singleUser: "app",
    userSetup: ["addgroup --system app && adduser --system --ingroup app app"],
    runtimeUserSetup: ["addgroup --system app && adduser --system --ingroup app app"],
    healthcheckCmd: "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\" || exit 1",
    artifactsMb: 48,
    copyArtifacts: (wd, user, chown) => {
      const c = chown ? ` --chown=${user}:${user}` : "";
      return [`COPY --from=builder /install /usr/local`, `COPY --from=builder${c} ${wd} .`];
    },
    color: "#facc15",
  },
  rust: {
    id: "rust",
    label: "Rust-slim",
    tagline: "cargo · static-ish binaries",
    repo: "rust",
    variants: [
      { tag: "1.75-slim", sizeMb: 760, note: "slim toolchain · recommended" },
      { tag: "1.75-slim-bookworm", sizeMb: 760, note: "pinned debian" },
      { tag: "1.75-alpine", sizeMb: 720, note: "musl target" },
    ],
    runtimeImage: { image: "debian:bookworm-slim", sizeMb: 75 },
    workdir: "/usr/src/app",
    manifests: "Cargo.toml Cargo.lock",
    installCmd: "cargo fetch",
    builderInstallCmd: "mkdir -p src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src",
    buildCmd: "cargo build --release",
    cmd: "app",
    entrypoint: "/usr/local/bin/app",
    port: 8080,
    cachePath: "/usr/local/cargo/registry",
    userName: "app",
    singleUser: "app",
    userSetup: ["useradd --system --uid 10001 --no-create-home app"],
    runtimeUserSetup: ["apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*", "useradd --system --uid 10001 --no-create-home app"],
    healthcheckCmd: "curl -fsS http://localhost:8080/health || exit 1",
    artifactsMb: 14,
    copyArtifacts: (wd, user, chown) => {
      const c = chown ? ` --chown=${user}:${user}` : "";
      return [`COPY --from=builder${c} ${wd}/target/release/app /usr/local/bin/app`];
    },
    color: "#f97316",
  },
  go: {
    id: "go",
    label: "Go 1.21",
    tagline: "static binary · distroless",
    repo: "golang",
    variants: [
      { tag: "1.21-alpine", sizeMb: 254, note: "alpine · recommended" },
      { tag: "1.22-alpine", sizeMb: 260, note: "latest minor" },
      { tag: "1.21-bookworm", sizeMb: 820, note: "debian · cgo" },
    ],
    runtimeImage: { image: "gcr.io/distroless/static-debian12:nonroot", sizeMb: 2 },
    workdir: "/src",
    manifests: "go.mod go.sum",
    installCmd: "go mod download",
    builderInstallCmd: "go mod download",
    buildCmd: "CGO_ENABLED=0 GOOS=linux go build -ldflags=\"-s -w\" -o /out/server ./cmd/server",
    cmd: "/server",
    entrypoint: "/server",
    port: 8080,
    cachePath: "/go/pkg/mod",
    userName: "nonroot",
    singleUser: "app",
    userSetup: ["adduser -D -u 10001 app"],
    runtimeUserSetup: [],
    healthcheckCmd: '["/server", "-healthcheck"]',
    artifactsMb: 12,
    copyArtifacts: () => [`COPY --from=builder /out/server /server`],
    color: "#22d3ee",
  },
  custom: {
    id: "custom",
    label: "Custom",
    tagline: "bring your own base image",
    repo: "",
    variants: [{ tag: "custom", sizeMb: 150, note: "unknown size" }],
    runtimeImage: { image: "alpine:3.19", sizeMb: 7 },
    workdir: "/app",
    manifests: "",
    installCmd: "",
    builderInstallCmd: "",
    buildCmd: "",
    cmd: "sh",
    entrypoint: "",
    port: 8080,
    cachePath: "/root/.cache",
    userName: "app",
    singleUser: "app",
    userSetup: ["adduser -D -u 10001 app"],
    runtimeUserSetup: ["adduser -D -u 10001 app"],
    healthcheckCmd: "wget -qO- http://localhost:8080/ || exit 1",
    artifactsMb: 20,
    copyArtifacts: (wd, user, chown) => [`COPY --from=builder${chown ? ` --chown=${user}:${user}` : ""} ${wd} .`],
    color: "#a78bfa",
  },
};

export function defaultConfig(base: BaseImageId, prev?: Partial<DockerfileConfig>): DockerfileConfig {
  const p = basePresets[base];
  const compiled = base === "rust" || base === "go";
  return {
    base,
    variant: p.variants[0].tag,
    customImage: prev?.customImage ?? "ubuntu:22.04",
    workdir: p.workdir,
    multiStage: compiled || base === "node20",
    copyManifestsFirst: true,
    installCmd: p.installCmd,
    buildCmd: p.buildCmd,
    env: base === "node20" ? [{ key: "NODE_ENV", value: "production" }] : base === "python311" ? [{ key: "PYTHONDONTWRITEBYTECODE", value: "1" }, { key: "PYTHONUNBUFFERED", value: "1" }] : [],
    ports: [p.port],
    nonRoot: true,
    healthcheck: true,
    healthcheckCmd: p.healthcheckCmd,
    labels: true,
    runtimeMode: base === "rust" || base === "go" ? "entrypoint" : "cmd",
    cmd: p.cmd,
    entrypoint: p.entrypoint,
    cacheMounts: true,
  };
}

export function baseImageRef(cfg: DockerfileConfig) {
  if (cfg.base === "custom") return cfg.customImage.trim() || "ubuntu:22.04";
  return `${basePresets[cfg.base].repo}:${cfg.variant}`;
}

const shellArray = (s: string) => `[${s.trim().split(/\s+/).map((x) => `"${x.replace(/"/g, '\\"')}"`).join(", ")}]`;

export function generateDockerfile(cfg: DockerfileConfig): string {
  const p = basePresets[cfg.base];
  const image = baseImageRef(cfg);
  const L: string[] = [];
  const runtimeUser = p.userName;
  const mount = (cmd: string) => (cfg.cacheMounts && cmd ? `RUN --mount=type=cache,target=${p.cachePath} \\\n    ${cmd}` : `RUN ${cmd}`);

  L.push("# syntax=docker/dockerfile:1.6");
  L.push(`# Generated by DockerPulse · ${p.label}${cfg.multiStage ? " · multi-stage" : ""}`);
  L.push("");

  if (cfg.multiStage) {
    L.push("# ---------- Build stage ----------");
    L.push(`FROM ${image} AS builder`);
    L.push(`WORKDIR ${cfg.workdir}`);
    L.push("");
    const bInstall = cfg.installCmd === p.installCmd ? p.builderInstallCmd : cfg.installCmd;
    if (cfg.copyManifestsFirst && p.manifests) {
      L.push("# Install dependencies first to maximise layer caching");
      L.push(`COPY ${p.manifests} ./`);
      if (bInstall) L.push(mount(bInstall));
      L.push("");
      L.push("COPY . .");
    } else {
      L.push("COPY . .");
      if (bInstall) L.push(mount(bInstall));
    }
    if (cfg.buildCmd) L.push(mount(cfg.buildCmd));
    if (p.prunePostBuild && cfg.base === "node20") L.push(`RUN ${p.prunePostBuild}`);
    L.push("");
    L.push("# ---------- Runtime stage ----------");
    L.push(`FROM ${p.runtimeImage.image}`);
    pushMeta(L, cfg);
    L.push(`WORKDIR ${cfg.workdir}`);
    if (cfg.nonRoot && p.runtimeUserSetup.length) {
      L.push("");
      L.push("# Create an unprivileged user");
      p.runtimeUserSetup.forEach((c) => L.push(`RUN ${c}`));
    }
    L.push("");
    L.push(...p.copyArtifacts(cfg.workdir, runtimeUser, cfg.nonRoot));
  } else {
    L.push(`FROM ${image}`);
    pushMeta(L, cfg);
    L.push(`WORKDIR ${cfg.workdir}`);
    L.push("");
    if (cfg.copyManifestsFirst && p.manifests) {
      L.push("# Install dependencies first to maximise layer caching");
      L.push(`COPY ${p.manifests} ./`);
      if (cfg.installCmd) L.push(mount(cfg.installCmd));
      L.push("");
      L.push("COPY . .");
    } else {
      L.push("COPY . .");
      if (cfg.installCmd) L.push(mount(cfg.installCmd));
    }
    if (cfg.buildCmd) L.push(mount(cfg.buildCmd));
    if (cfg.nonRoot) {
      L.push("");
      L.push("# Drop privileges");
      const userSetup = cfg.base === "custom" ? (/alpine|busybox/i.test(image) ? ["adduser -D -u 10001 app"] : ["useradd --system --uid 10001 --no-create-home app"]) : p.userSetup;
      userSetup.forEach((c) => L.push(`RUN ${c}`));
      L.push(`RUN chown -R ${p.singleUser}:${p.singleUser} ${cfg.workdir}`);
    }
  }

  L.push("");
  if (cfg.ports.length) L.push(`EXPOSE ${cfg.ports.join(" ")}`);
  if (cfg.healthcheck && cfg.healthcheckCmd.trim()) {
    L.push(`HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\`);
    L.push(`    CMD ${cfg.healthcheckCmd.trim()}`);
  }
  if (cfg.nonRoot) L.push(`USER ${cfg.multiStage ? runtimeUser : p.singleUser}`);
  L.push("");
  if (cfg.runtimeMode === "entrypoint" || cfg.runtimeMode === "both") {
    if (cfg.entrypoint.trim()) L.push(`ENTRYPOINT ${shellArray(cfg.entrypoint)}`);
  }
  if (cfg.runtimeMode === "cmd" || cfg.runtimeMode === "both") {
    if (cfg.cmd.trim()) L.push(`CMD ${shellArray(cfg.cmd)}`);
  }
  if (cfg.runtimeMode === "entrypoint" && cfg.cmd.trim() && cfg.cmd.trim() !== cfg.entrypoint.trim() && cfg.base !== "rust" && cfg.base !== "go") {
    L.push(`CMD ${shellArray(cfg.cmd)}`);
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function pushMeta(L: string[], cfg: DockerfileConfig) {
  if (cfg.labels) {
    L.push("");
    L.push(`LABEL org.opencontainers.image.title="my-service" \\`);
    L.push(`      org.opencontainers.image.source="https://github.com/acme/my-service" \\`);
    L.push(`      org.opencontainers.image.vendor="DockerPulse"`);
  }
  const envs = cfg.env.filter((e) => e.key.trim());
  if (envs.length) {
    L.push("");
    L.push(`ENV ${envs.map((e) => `${e.key.trim()}=${/\s/.test(e.value) ? `"${e.value}"` : e.value}`).join(" \\\n    ")}`);
  }
  L.push("");
}

export interface LintItem {
  level: "ok" | "warn" | "error";
  title: string;
  detail: string;
}

export function lintConfig(cfg: DockerfileConfig): LintItem[] {
  const items: LintItem[] = [];
  const image = baseImageRef(cfg);
  const compiled = cfg.base === "rust" || cfg.base === "go";

  if (cfg.base === "custom" && (!image.includes(":") || image.endsWith(":latest"))) items.push({ level: "error", title: "Unpinned base image", detail: `"${image}" resolves to :latest — builds become non-reproducible. Pin a digest or version tag.` });
  else items.push({ level: "ok", title: "Base image pinned", detail: `${image} is version-tagged.` });

  if (compiled && !cfg.multiStage) items.push({ level: "error", title: "Shipping the compiler", detail: "Rust/Go toolchains add 700MB+. Enable multi-stage to copy only the binary into a slim runtime." });
  else if (cfg.multiStage) items.push({ level: "ok", title: "Multi-stage build", detail: "Build toolchain is discarded; runtime stage only carries artifacts." });
  else items.push({ level: "warn", title: "Single-stage build", detail: "Dev dependencies and build caches end up in the final image." });

  if (!cfg.nonRoot) items.push({ level: "warn", title: "Runs as root", detail: "Containers run as UID 0 by default. Add a USER instruction to reduce blast radius." });
  else items.push({ level: "ok", title: "Non-root user", detail: "Process drops privileges before start." });

  if (!cfg.healthcheck) items.push({ level: "warn", title: "No HEALTHCHECK", detail: "Orchestrators can't distinguish a hung process from a healthy one." });
  else items.push({ level: "ok", title: "HEALTHCHECK defined", detail: "Status will show healthy/unhealthy in docker ps." });

  if (!cfg.copyManifestsFirst) items.push({ level: "warn", title: "Poor layer caching", detail: "Copying the full source before installing deps invalidates the dependency layer on every code change." });
  else items.push({ level: "ok", title: "Dependency layer cached", detail: "Manifests are copied before source so installs only re-run when they change." });

  if (!cfg.ports.length) items.push({ level: "warn", title: "No EXPOSE", detail: "EXPOSE documents the listening port for operators and compose tooling." });

  const secret = cfg.env.find((e) => /(password|secret|token|api_?key|private)/i.test(e.key));
  if (secret) items.push({ level: "error", title: "Secret baked into image", detail: `ENV ${secret.key} will be visible in image history. Inject at runtime or use --mount=type=secret.` });

  if (cfg.cacheMounts) items.push({ level: "ok", title: "BuildKit cache mounts", detail: "Package manager caches persist across builds without bloating layers." });

  if (cfg.runtimeMode === "cmd" && !cfg.cmd.trim()) items.push({ level: "error", title: "No CMD", detail: "Container has nothing to run." });
  if ((cfg.runtimeMode === "entrypoint" || cfg.runtimeMode === "both") && !cfg.entrypoint.trim()) items.push({ level: "error", title: "Empty ENTRYPOINT", detail: "Provide an executable for ENTRYPOINT." });

  return items;
}

export function estimateSize(cfg: DockerfileConfig) {
  const p = basePresets[cfg.base];
  const variant = p.variants.find((v) => v.tag === cfg.variant) ?? p.variants[0];
  if (cfg.multiStage) return p.runtimeImage.sizeMb + p.artifactsMb + (cfg.nonRoot && cfg.base === "rust" ? 6 : 0);
  const deps = cfg.base === "node20" ? 95 : cfg.base === "python311" ? 60 : cfg.base === "rust" ? 850 : cfg.base === "go" ? 320 : 40;
  return variant.sizeMb + deps;
}

export function scoreConfig(items: LintItem[]) {
  const errors = items.filter((i) => i.level === "error").length;
  const warns = items.filter((i) => i.level === "warn").length;
  return Math.max(0, Math.min(100, 100 - errors * 25 - warns * 10));
}
