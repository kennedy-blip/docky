export type TabId = "fleet" | "dockerfile" | "compose" | "registry";

export type ContainerStatus = "running" | "restarting" | "stopped";
export type HealthStatus = "healthy" | "unhealthy" | "starting" | "none";

export interface PortMapping {
  host: number;
  container: number;
  proto: "tcp" | "udp";
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  health: HealthStatus;
  ports: PortMapping[];
  startedAt: number | null;
  cpu: number;
  cpuHistory: number[];
  mem: number;
  memLimit: number;
  networks: string[];
  mounts: string[];
  env: Record<string, string>;
  command: string;
  restarts: number;
  createdAt: number;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  sizeMb: number;
  createdAt: number;
  dangling: boolean;
}

export interface RegistryTag {
  name: string;
  sizeMb: number;
  arch: string[];
  updated: string;
}

export interface RegistryImage {
  name: string;
  publisher: string;
  description: string;
  official: boolean;
  verified: boolean;
  stars: number;
  pulls: string;
  category: string;
  tags: RegistryTag[];
  updated: string;
}

export interface LogLine {
  ts: number;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  msg: string;
}

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

/* Dockerfile builder */
export type BaseImageId = "node20" | "python311" | "rust" | "go" | "custom";

export interface EnvVar {
  key: string;
  value: string;
}

export interface DockerfileConfig {
  base: BaseImageId;
  variant: string;
  customImage: string;
  workdir: string;
  multiStage: boolean;
  copyManifestsFirst: boolean;
  installCmd: string;
  buildCmd: string;
  env: EnvVar[];
  ports: number[];
  nonRoot: boolean;
  healthcheck: boolean;
  healthcheckCmd: string;
  labels: boolean;
  runtimeMode: "cmd" | "entrypoint" | "both";
  cmd: string;
  entrypoint: string;
  cacheMounts: boolean;
}
