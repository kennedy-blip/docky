import type { Container, DockerImage, RegistryImage } from "../types";

const HEX = "0123456789abcdef";
export const randomHex = (len = 12) =>
  Array.from({ length: len }, () => HEX[Math.floor(Math.random() * 16)]).join("");

const now = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const history = (base: number, n = 30) =>
  Array.from({ length: n }, () => Math.max(0, base + (Math.random() - 0.5) * base * 0.6));

export const initialContainers: Container[] = [
  {
    id: "a1f3c9e2b7d4",
    name: "postgres-db",
    image: "postgres:15-alpine",
    status: "running",
    health: "healthy",
    ports: [{ host: 5432, container: 5432, proto: "tcp" }],
    startedAt: now - 3 * DAY - 4 * HOUR - 12 * MIN,
    cpu: 3.2,
    cpuHistory: history(3.2),
    mem: 186,
    memLimit: 512,
    networks: ["backend"],
    mounts: ["pgdata:/var/lib/postgresql/data", "./init.sql:/docker-entrypoint-initdb.d/init.sql:ro"],
    env: { POSTGRES_DB: "dockerpulse", POSTGRES_USER: "app", PGDATA: "/var/lib/postgresql/data" },
    command: "postgres -c max_connections=200",
    restarts: 0,
    createdAt: now - 12 * DAY,
  },
  {
    id: "7b2e5d8f1a6c",
    name: "redis-cache",
    image: "redis:alpine",
    status: "running",
    health: "healthy",
    ports: [{ host: 6379, container: 6379, proto: "tcp" }],
    startedAt: now - 3 * DAY - 4 * HOUR - 10 * MIN,
    cpu: 0.8,
    cpuHistory: history(0.8),
    mem: 24,
    memLimit: 256,
    networks: ["backend"],
    mounts: ["redisdata:/data"],
    env: { REDIS_ARGS: "--appendonly yes" },
    command: "redis-server --appendonly yes",
    restarts: 0,
    createdAt: now - 12 * DAY,
  },
  {
    id: "c4d9a0e6f2b1",
    name: "nginx-proxy",
    image: "nginx:1.25-alpine",
    status: "running",
    health: "healthy",
    ports: [
      { host: 8080, container: 80, proto: "tcp" },
      { host: 8443, container: 443, proto: "tcp" },
    ],
    startedAt: now - 1 * DAY - 2 * HOUR - 33 * MIN,
    cpu: 1.4,
    cpuHistory: history(1.4),
    mem: 12,
    memLimit: 128,
    networks: ["frontend", "backend"],
    mounts: ["./nginx.conf:/etc/nginx/nginx.conf:ro", "./certs:/etc/nginx/certs:ro"],
    env: { NGINX_ENTRYPOINT_QUIET_LOGS: "1" },
    command: "nginx -g 'daemon off;'",
    restarts: 1,
    createdAt: now - 9 * DAY,
  },
  {
    id: "e8f1b3c7d5a2",
    name: "api-backend",
    image: "dockerpulse/api:2.4.1",
    status: "running",
    health: "healthy",
    ports: [{ host: 3000, container: 3000, proto: "tcp" }],
    startedAt: now - 5 * HOUR - 18 * MIN,
    cpu: 18.6,
    cpuHistory: history(18.6),
    mem: 312,
    memLimit: 1024,
    networks: ["backend"],
    mounts: ["./uploads:/app/uploads"],
    env: { NODE_ENV: "production", PORT: "3000", DATABASE_URL: "postgres://app@postgres-db:5432/dockerpulse", REDIS_URL: "redis://redis-cache:6379" },
    command: "node dist/server.js",
    restarts: 0,
    createdAt: now - 2 * DAY,
  },
  {
    id: "2f6a8c1d9e3b",
    name: "worker-queue",
    image: "dockerpulse/worker:2.4.1",
    status: "restarting",
    health: "starting",
    ports: [],
    startedAt: now - 42_000,
    cpu: 0,
    cpuHistory: history(0),
    mem: 0,
    memLimit: 512,
    networks: ["backend"],
    mounts: [],
    env: { NODE_ENV: "production", QUEUE_CONCURRENCY: "4", REDIS_URL: "redis://redis-cache:6379" },
    command: "node dist/worker.js",
    restarts: 7,
    createdAt: now - 2 * DAY,
  },
  {
    id: "9d3b7e4a2c8f",
    name: "prometheus",
    image: "prom/prometheus:v2.48.0",
    status: "running",
    health: "none",
    ports: [{ host: 9090, container: 9090, proto: "tcp" }],
    startedAt: now - 6 * DAY - 11 * HOUR,
    cpu: 2.1,
    cpuHistory: history(2.1),
    mem: 148,
    memLimit: 512,
    networks: ["monitoring", "backend"],
    mounts: ["promdata:/prometheus", "./prometheus.yml:/etc/prometheus/prometheus.yml:ro"],
    env: {},
    command: "--config.file=/etc/prometheus/prometheus.yml",
    restarts: 0,
    createdAt: now - 20 * DAY,
  },
  {
    id: "5c1e9f7b3a4d",
    name: "grafana",
    image: "grafana/grafana:10.2.3",
    status: "stopped",
    health: "none",
    ports: [{ host: 3001, container: 3000, proto: "tcp" }],
    startedAt: null,
    cpu: 0,
    cpuHistory: history(0),
    mem: 0,
    memLimit: 512,
    networks: ["monitoring"],
    mounts: ["grafanadata:/var/lib/grafana"],
    env: { GF_SECURITY_ADMIN_PASSWORD: "********", GF_INSTALL_PLUGINS: "grafana-piechart-panel" },
    command: "/run.sh",
    restarts: 0,
    createdAt: now - 20 * DAY,
  },
  {
    id: "b6a2d4f8e1c3",
    name: "mailhog",
    image: "mailhog/mailhog:latest",
    status: "stopped",
    health: "none",
    ports: [
      { host: 8025, container: 8025, proto: "tcp" },
      { host: 1025, container: 1025, proto: "tcp" },
    ],
    startedAt: null,
    cpu: 0,
    cpuHistory: history(0),
    mem: 0,
    memLimit: 128,
    networks: ["backend"],
    mounts: [],
    env: { MH_STORAGE: "maildir" },
    command: "MailHog",
    restarts: 0,
    createdAt: now - 30 * DAY,
  },
];

export const initialImages: DockerImage[] = [
  { id: "sha256:" + randomHex(12), repository: "postgres", tag: "15-alpine", sizeMb: 241, createdAt: now - 14 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "redis", tag: "alpine", sizeMb: 41, createdAt: now - 14 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "nginx", tag: "1.25-alpine", sizeMb: 43, createdAt: now - 10 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "dockerpulse/api", tag: "2.4.1", sizeMb: 187, createdAt: now - 2 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "dockerpulse/worker", tag: "2.4.1", sizeMb: 165, createdAt: now - 2 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "prom/prometheus", tag: "v2.48.0", sizeMb: 245, createdAt: now - 21 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "grafana/grafana", tag: "10.2.3", sizeMb: 391, createdAt: now - 21 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "mailhog/mailhog", tag: "latest", sizeMb: 392, createdAt: now - 31 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "dockerpulse/api", tag: "2.3.9", sizeMb: 184, createdAt: now - 9 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "node", tag: "20-alpine", sizeMb: 181, createdAt: now - 5 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "python", tag: "3.11-slim", sizeMb: 131, createdAt: now - 16 * DAY, dangling: false },
  { id: "sha256:" + randomHex(12), repository: "<none>", tag: "<none>", sizeMb: 312, createdAt: now - 3 * DAY, dangling: true },
  { id: "sha256:" + randomHex(12), repository: "<none>", tag: "<none>", sizeMb: 118, createdAt: now - 6 * DAY, dangling: true },
  { id: "sha256:" + randomHex(12), repository: "<none>", tag: "<none>", sizeMb: 86, createdAt: now - 8 * DAY, dangling: true },
];

/* ---------- Registry catalog (simulated Docker Hub) ---------- */
export const registryCatalog: RegistryImage[] = [
  {
    name: "nginx", publisher: "Docker Official Image", description: "Official build of Nginx — high performance web server, reverse proxy and load balancer.",
    official: true, verified: true, stars: 20412, pulls: "1B+", category: "Web Servers", updated: "2 days ago",
    tags: [
      { name: "latest", sizeMb: 67, arch: ["amd64", "arm64", "arm/v7"], updated: "2 days ago" },
      { name: "1.25-alpine", sizeMb: 43, arch: ["amd64", "arm64"], updated: "2 days ago" },
      { name: "1.25", sizeMb: 67, arch: ["amd64", "arm64"], updated: "2 days ago" },
      { name: "stable-alpine", sizeMb: 42, arch: ["amd64", "arm64"], updated: "1 week ago" },
    ],
  },
  {
    name: "postgres", publisher: "Docker Official Image", description: "The PostgreSQL object-relational database system provides reliability and data integrity.",
    official: true, verified: true, stars: 14210, pulls: "1B+", category: "Databases", updated: "3 days ago",
    tags: [
      { name: "16", sizeMb: 432, arch: ["amd64", "arm64"], updated: "3 days ago" },
      { name: "16-alpine", sizeMb: 248, arch: ["amd64", "arm64"], updated: "3 days ago" },
      { name: "15-alpine", sizeMb: 241, arch: ["amd64", "arm64"], updated: "3 days ago" },
      { name: "14", sizeMb: 428, arch: ["amd64", "arm64", "ppc64le"], updated: "3 days ago" },
    ],
  },
  {
    name: "redis", publisher: "Docker Official Image", description: "Redis is an open source, in-memory key-value store used as a database, cache and message broker.",
    official: true, verified: true, stars: 13250, pulls: "1B+", category: "Databases", updated: "5 days ago",
    tags: [
      { name: "7.2", sizeMb: 138, arch: ["amd64", "arm64"], updated: "5 days ago" },
      { name: "alpine", sizeMb: 41, arch: ["amd64", "arm64", "arm/v6"], updated: "5 days ago" },
      { name: "7.2-bookworm", sizeMb: 138, arch: ["amd64", "arm64"], updated: "5 days ago" },
    ],
  },
  {
    name: "node", publisher: "Docker Official Image", description: "Node.js is a JavaScript-based platform for server-side and networking applications.",
    official: true, verified: true, stars: 13890, pulls: "1B+", category: "Languages", updated: "1 day ago",
    tags: [
      { name: "20-alpine", sizeMb: 181, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "20-bookworm-slim", sizeMb: 220, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "22-alpine", sizeMb: 190, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "lts", sizeMb: 1120, arch: ["amd64", "arm64", "s390x"], updated: "1 day ago" },
    ],
  },
  {
    name: "python", publisher: "Docker Official Image", description: "Python is an interpreted, interactive, object-oriented, open-source programming language.",
    official: true, verified: true, stars: 10120, pulls: "1B+", category: "Languages", updated: "1 day ago",
    tags: [
      { name: "3.12-slim", sizeMb: 154, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "3.11-slim", sizeMb: 131, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "3.11-alpine", sizeMb: 52, arch: ["amd64", "arm64"], updated: "1 day ago" },
      { name: "3.12", sizeMb: 1020, arch: ["amd64", "arm64"], updated: "1 day ago" },
    ],
  },
  {
    name: "rust", publisher: "Docker Official Image", description: "Rust is a systems programming language focused on safety, speed, and concurrency.",
    official: true, verified: true, stars: 1240, pulls: "100M+", category: "Languages", updated: "4 days ago",
    tags: [
      { name: "1.75-slim", sizeMb: 760, arch: ["amd64", "arm64"], updated: "4 days ago" },
      { name: "1.75-alpine", sizeMb: 720, arch: ["amd64", "arm64"], updated: "4 days ago" },
      { name: "latest", sizeMb: 1400, arch: ["amd64", "arm64"], updated: "4 days ago" },
    ],
  },
  {
    name: "golang", publisher: "Docker Official Image", description: "Go (golang) is a general purpose, higher-level, imperative programming language.",
    official: true, verified: true, stars: 4890, pulls: "1B+", category: "Languages", updated: "2 days ago",
    tags: [
      { name: "1.21-alpine", sizeMb: 254, arch: ["amd64", "arm64"], updated: "2 days ago" },
      { name: "1.22", sizeMb: 820, arch: ["amd64", "arm64"], updated: "2 days ago" },
    ],
  },
  {
    name: "mongo", publisher: "Docker Official Image", description: "MongoDB document databases provide high availability and easy scalability.",
    official: true, verified: true, stars: 10320, pulls: "1B+", category: "Databases", updated: "6 days ago",
    tags: [
      { name: "7.0", sizeMb: 756, arch: ["amd64", "arm64"], updated: "6 days ago" },
      { name: "6.0", sizeMb: 710, arch: ["amd64", "arm64"], updated: "6 days ago" },
    ],
  },
  {
    name: "mysql", publisher: "Docker Official Image", description: "MySQL is a widely used, open-source relational database management system (RDBMS).",
    official: true, verified: true, stars: 15040, pulls: "1B+", category: "Databases", updated: "1 week ago",
    tags: [
      { name: "8.2", sizeMb: 603, arch: ["amd64", "arm64"], updated: "1 week ago" },
      { name: "8.0", sizeMb: 591, arch: ["amd64", "arm64"], updated: "1 week ago" },
    ],
  },
  {
    name: "rabbitmq", publisher: "Docker Official Image", description: "RabbitMQ is an open source multi-protocol messaging broker.",
    official: true, verified: true, stars: 5210, pulls: "1B+", category: "Messaging", updated: "3 days ago",
    tags: [
      { name: "3.12-management-alpine", sizeMb: 176, arch: ["amd64", "arm64"], updated: "3 days ago" },
      { name: "3.12-alpine", sizeMb: 108, arch: ["amd64", "arm64"], updated: "3 days ago" },
    ],
  },
  {
    name: "grafana/grafana", publisher: "Grafana Labs", description: "The open observability platform — dashboards, alerting and data visualization.",
    official: false, verified: true, stars: 3120, pulls: "1B+", category: "Monitoring", updated: "2 days ago",
    tags: [
      { name: "10.2.3", sizeMb: 391, arch: ["amd64", "arm64"], updated: "2 days ago" },
      { name: "latest", sizeMb: 395, arch: ["amd64", "arm64"], updated: "2 days ago" },
    ],
  },
  {
    name: "prom/prometheus", publisher: "Prometheus", description: "The Prometheus monitoring system and time series database.",
    official: false, verified: true, stars: 2980, pulls: "1B+", category: "Monitoring", updated: "1 week ago",
    tags: [
      { name: "v2.48.0", sizeMb: 245, arch: ["amd64", "arm64"], updated: "1 week ago" },
      { name: "latest", sizeMb: 247, arch: ["amd64", "arm64"], updated: "1 week ago" },
    ],
  },
  {
    name: "traefik", publisher: "Docker Official Image", description: "Traefik, the cloud native application proxy and edge router.",
    official: true, verified: true, stars: 3460, pulls: "1B+", category: "Web Servers", updated: "4 days ago",
    tags: [
      { name: "v3.0", sizeMb: 172, arch: ["amd64", "arm64"], updated: "4 days ago" },
      { name: "v2.11", sizeMb: 160, arch: ["amd64", "arm64"], updated: "4 days ago" },
    ],
  },
  {
    name: "elasticsearch", publisher: "Docker Official Image", description: "Elasticsearch is a powerful open source search and analytics engine that makes data easy to explore.",
    official: true, verified: true, stars: 6340, pulls: "500M+", category: "Search", updated: "2 weeks ago",
    tags: [
      { name: "8.11.3", sizeMb: 1380, arch: ["amd64", "arm64"], updated: "2 weeks ago" },
    ],
  },
  {
    name: "minio/minio", publisher: "MinIO", description: "High performance, Kubernetes-native S3-compatible object storage.",
    official: false, verified: true, stars: 1120, pulls: "1B+", category: "Storage", updated: "5 days ago",
    tags: [
      { name: "latest", sizeMb: 158, arch: ["amd64", "arm64", "ppc64le"], updated: "5 days ago" },
    ],
  },
  {
    name: "mailhog/mailhog", publisher: "MailHog", description: "Web and API based SMTP testing tool for developers.",
    official: false, verified: false, stars: 540, pulls: "100M+", category: "Dev Tools", updated: "3 years ago",
    tags: [
      { name: "latest", sizeMb: 392, arch: ["amd64"], updated: "3 years ago" },
    ],
  },
  {
    name: "alpine", publisher: "Docker Official Image", description: "A minimal Docker image based on Alpine Linux with a complete package index and only 5 MB in size!",
    official: true, verified: true, stars: 11010, pulls: "1B+", category: "Base Images", updated: "1 week ago",
    tags: [
      { name: "3.19", sizeMb: 7, arch: ["amd64", "arm64", "arm/v6", "s390x"], updated: "1 week ago" },
      { name: "latest", sizeMb: 7, arch: ["amd64", "arm64"], updated: "1 week ago" },
    ],
  },
  {
    name: "ubuntu", publisher: "Docker Official Image", description: "Ubuntu is a Debian-based Linux operating system based on free software.",
    official: true, verified: true, stars: 17200, pulls: "1B+", category: "Base Images", updated: "3 days ago",
    tags: [
      { name: "22.04", sizeMb: 77, arch: ["amd64", "arm64"], updated: "3 days ago" },
      { name: "24.04", sizeMb: 78, arch: ["amd64", "arm64"], updated: "3 days ago" },
    ],
  },
  {
    name: "bitnami/kafka", publisher: "Bitnami", description: "Apache Kafka is a distributed streaming platform designed to build real-time pipelines.",
    official: false, verified: true, stars: 870, pulls: "500M+", category: "Messaging", updated: "2 days ago",
    tags: [
      { name: "3.6", sizeMb: 580, arch: ["amd64", "arm64"], updated: "2 days ago" },
    ],
  },
  {
    name: "dockerpulse/api", publisher: "dockerpulse", description: "DockerPulse REST API backend — Node.js 20, Fastify, Prisma.",
    official: false, verified: false, stars: 42, pulls: "10K+", category: "Apps", updated: "2 days ago",
    tags: [
      { name: "2.4.1", sizeMb: 187, arch: ["amd64", "arm64"], updated: "2 days ago" },
      { name: "2.3.9", sizeMb: 184, arch: ["amd64", "arm64"], updated: "9 days ago" },
    ],
  },
];

/* ---------- Log line generators ---------- */
const logTemplates: Record<string, string[]> = {
  "postgres-db": [
    "LOG:  checkpoint starting: time",
    "LOG:  checkpoint complete: wrote 42 buffers (0.3%); 0 WAL file(s) added",
    "LOG:  automatic vacuum of table \"dockerpulse.public.events\": index scans: 1",
    "LOG:  connection received: host=172.18.0.5 port=51234",
    "LOG:  connection authorized: user=app database=dockerpulse",
    "LOG:  duration: 12.431 ms  statement: SELECT * FROM containers WHERE status = $1",
    "LOG:  autovacuum launcher started",
  ],
  "redis-cache": [
    "* 1 changes in 3600 seconds. Saving...",
    "* Background saving started by pid 21",
    "* DB saved on disk",
    "* RDB: 0 MB of memory used by copy-on-write",
    "* Background saving terminated with success",
    "# Server initialized",
    "* Ready to accept connections tcp",
  ],
  "nginx-proxy": [
    "172.18.0.1 - - \"GET /api/v1/containers HTTP/1.1\" 200 1843 \"-\" \"Mozilla/5.0\"",
    "172.18.0.1 - - \"GET /healthz HTTP/1.1\" 200 2 \"-\" \"kube-probe/1.28\"",
    "172.18.0.1 - - \"POST /api/v1/containers/restart HTTP/1.1\" 202 14 \"-\" \"curl/8.4.0\"",
    "172.18.0.1 - - \"GET /static/app.js HTTP/1.1\" 304 0 \"-\" \"Mozilla/5.0\"",
    "172.18.0.1 - - \"GET /metrics HTTP/1.1\" 200 9212 \"-\" \"Prometheus/2.48.0\"",
    "upstream api-backend:3000 responded in 0.014s",
  ],
  "api-backend": [
    "Server listening at http://0.0.0.0:3000",
    "incoming request GET /api/v1/containers reqId=req-1a2b3c",
    "request completed 200 in 12ms reqId=req-1a2b3c",
    "prisma:query SELECT \"id\",\"name\" FROM \"Container\" WHERE status = $1",
    "cache hit key=fleet:summary ttl=27s",
    "ws: client connected sessions=4",
    "metrics: cpu=18.4% rss=312MB eventloop_lag=1.2ms",
    "job enqueued queue=image-scan id=job_8f2e",
  ],
  "worker-queue": [
    "Worker starting with concurrency=4",
    "Connecting to redis://redis-cache:6379",
    "Error: connect ECONNREFUSED 172.18.0.3:6379",
    "    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)",
    "Retrying in 5000ms (attempt 7/10)",
    "Process exited with code 1",
    "Restarting container...",
  ],
  prometheus: [
    "ts=2024-01-15T10:22:01.123Z caller=main.go:1183 level=info msg=\"Completed loading of configuration file\"",
    "ts=2024-01-15T10:22:11.001Z caller=scrape.go:1384 level=info target=api-backend:3000 msg=\"scrape ok\" duration=12ms",
    "ts=2024-01-15T10:22:11.002Z caller=compact.go:519 level=info component=tsdb msg=\"write block\" mint=1705312800000",
    "ts=2024-01-15T10:22:21.101Z caller=head.go:1221 level=info component=tsdb msg=\"WAL checkpoint complete\" duration=312ms",
  ],
  grafana: [
    "logger=settings t=2024-01-15T10:22:01Z level=info msg=\"Starting Grafana\" version=10.2.3",
    "logger=sqlstore t=2024-01-15T10:22:01Z level=info msg=\"Connecting to DB\" dbtype=sqlite3",
    "logger=http.server t=2024-01-15T10:22:02Z level=info msg=\"HTTP Server Listen\" address=[::]:3000",
    "logger=plugins.update.checker level=info msg=\"Update check succeeded\" duration=312ms",
  ],
  mailhog: [
    "[SMTP] Binding to address: 0.0.0.0:1025",
    "[HTTP] Binding to address: 0.0.0.0:8025",
    "Creating API v1 with WebPath: ",
    "Creating API v2 with WebPath: ",
    "[APIv1] KEEPALIVE /api/v1/events",
  ],
};

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

const levelFor = (msg: string): Level => {
  if (/error|refused|exited|at TCPConnectWrap/i.test(msg)) return "ERROR";
  if (/retry|warn|304|restarting/i.test(msg)) return "WARN";
  if (/prisma:query|cache hit|debug|KEEPALIVE/i.test(msg)) return "DEBUG";
  return "INFO";
};

export function generateLog(name: string): { level: Level; msg: string } {
  const list = logTemplates[name] ?? ["container heartbeat ok", "processing request", "gc pause 1.2ms"];
  const msg = list[Math.floor(Math.random() * list.length)];
  return { level: levelFor(msg), msg };
}

export function seedLogs(name: string, n = 18): { ts: number; level: Level; msg: string }[] {
  const list = logTemplates[name] ?? ["container started"];
  const base = Date.now() - n * 4000;
  return Array.from({ length: n }, (_, i) => {
    const msg = list[i % list.length];
    return { ts: base + i * 4000 + Math.random() * 1500, level: levelFor(msg), msg };
  });
}

/* ---------- Compose templates ---------- */
export const composeTemplates: Record<string, string> = {
  "Web Stack": `version: "3.9"

services:
  nginx-proxy:
    image: nginx:1.25-alpine
    container_name: nginx-proxy
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api-backend
    networks:
      - frontend
      - backend
    restart: unless-stopped

  api-backend:
    image: dockerpulse/api:2.4.1
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://app:secret@postgres-db:5432/dockerpulse
      REDIS_URL: redis://redis-cache:6379
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      postgres-db:
        condition: service_healthy
      redis-cache:
        condition: service_started
    networks:
      - backend
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

  worker-queue:
    image: dockerpulse/worker:2.4.1
    command: node dist/worker.js
    environment:
      QUEUE_CONCURRENCY: 4
      REDIS_URL: redis://redis-cache:6379
    depends_on:
      - redis-cache
    networks:
      - backend
    deploy:
      replicas: 2

  postgres-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: dockerpulse
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      retries: 5

  redis-cache:
    image: redis:alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  pgdata:
  redisdata:
`,
  "Monitoring Stack": `version: "3.9"

services:
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - promdata:/prometheus
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:10.2.3
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafanadata:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:v1.7.0
    ports:
      - "9100:9100"
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.2
    ports:
      - "8081:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  promdata:
  grafanadata:
`,
  "WordPress": `version: "3.8"

services:
  wordpress:
    image: wordpress:6.4-php8.2-apache
    ports:
      - "8000:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wp_content:/var/www/html/wp-content
    depends_on:
      - db
    networks:
      - wpnet

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp
      MYSQL_RANDOM_ROOT_PASSWORD: "1"
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - wpnet

  adminer:
    image: adminer:4.8.1
    ports:
      - "8082:8080"
    depends_on:
      - db
    networks:
      - wpnet

networks:
  wpnet:

volumes:
  wp_content:
  db_data:
`,
  "Broken Example": `version: "3.9"

services:
  web:
    ports:
      - "80:80:80"
    depends_on:
      - api
    networks:
      - public

  api:
    image: myorg/api:latest
    volumes:
      - cache:/tmp/cache
    networks:
      - internal

  db:
    image: postgres
    volumes:
      - dbdata:/var/lib/postgresql/data

networks:
  internal:

volumes:
  dbdata:
`,
};
