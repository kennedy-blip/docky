import { useCallback, useEffect, useRef, useState } from "react";
import type { Container, DockerImage } from "../types";
import { initialContainers, initialImages, randomHex } from "../data/mock";

const HISTORY_LEN = 30;

const baselineFor = (c: Container) => {
  const map: Record<string, number> = {
    "postgres-db": 3.2,
    "redis-cache": 0.8,
    "nginx-proxy": 1.4,
    "api-backend": 18.6,
    "worker-queue": 9.5,
    prometheus: 2.1,
    grafana: 4.2,
    mailhog: 0.4,
  };
  return map[c.name] ?? 2 + Math.random() * 10;
};

const memBaseFor = (c: Container) => {
  const map: Record<string, number> = {
    "postgres-db": 186,
    "redis-cache": 24,
    "nginx-proxy": 12,
    "api-backend": 312,
    "worker-queue": 142,
    prometheus: 148,
    grafana: 96,
    mailhog: 18,
  };
  return map[c.name] ?? Math.round(c.memLimit * 0.3);
};

export function useFleet() {
  const [containers, setContainers] = useState<Container[]>(initialContainers);
  const [images, setImages] = useState<DockerImage[]>(initialImages);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<number[]>([]);

  /* 1s clock for uptime counters */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* Live metrics simulation */
  useEffect(() => {
    const t = window.setInterval(() => {
      setContainers((prev) =>
        prev.map((c) => {
          if (c.status !== "running") {
            return { ...c, cpu: 0, mem: 0, cpuHistory: [...c.cpuHistory.slice(-(HISTORY_LEN - 1)), 0] };
          }
          const base = baselineFor(c);
          const spike = Math.random() < 0.06 ? base * (1.5 + Math.random() * 2) : 0;
          const target = base + spike;
          const cpu = Math.max(0.1, Math.min(99, c.cpu + (target - c.cpu) * 0.35 + (Math.random() - 0.5) * base * 0.5));
          const memBase = memBaseFor(c);
          const mem = Math.max(4, Math.min(c.memLimit * 0.97, c.mem + (memBase - c.mem) * 0.08 + (Math.random() - 0.5) * memBase * 0.06));
          return { ...c, cpu, mem, cpuHistory: [...c.cpuHistory.slice(-(HISTORY_LEN - 1)), cpu] };
        }),
      );
    }, 1500);
    return () => window.clearInterval(t);
  }, []);

  /* Cleanup pending timers on unmount */
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  const patch = useCallback((id: string, fn: (c: Container) => Partial<Container>) => {
    setContainers((prev) => prev.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)));
  }, []);

  /* Initially restarting worker eventually stabilises */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setContainers((prev) =>
        prev.map((c) => (c.name === "worker-queue" && c.status === "restarting" ? { ...c, status: "running", health: "healthy", startedAt: Date.now(), restarts: c.restarts + 1, mem: 60 } : c)),
      );
    }, 9000);
    return () => window.clearTimeout(t);
  }, []);

  const start = useCallback(
    (id: string) => {
      patch(id, () => ({ status: "running", startedAt: Date.now(), health: "starting", mem: 8, cpu: 0.5 }));
      later(() => patch(id, (c) => (c.status === "running" ? { health: "healthy" } : {})), 5000);
    },
    [patch],
  );

  const stop = useCallback(
    (id: string) => {
      patch(id, () => ({ status: "stopped", startedAt: null, cpu: 0, mem: 0, health: "none" }));
    },
    [patch],
  );

  const restart = useCallback(
    (id: string) => {
      patch(id, () => ({ status: "restarting", health: "starting", cpu: 0, mem: 0 }));
      later(() => patch(id, (c) => ({ status: "running", startedAt: Date.now(), restarts: c.restarts + 1, mem: 8, cpu: 0.5 })), 2600);
      later(() => patch(id, (c) => (c.status === "running" ? { health: "healthy" } : {})), 7000);
    },
    [patch],
  );

  const remove = useCallback((id: string) => {
    setContainers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const runFromImage = useCallback((repository: string, tag: string) => {
    const short = repository.split("/").pop() ?? repository;
    const name = `${short}-${randomHex(4)}`;
    const c: Container = {
      id: randomHex(12),
      name,
      image: `${repository}:${tag}`,
      status: "running",
      health: "starting",
      ports: [],
      startedAt: Date.now(),
      cpu: 0.5,
      cpuHistory: Array(HISTORY_LEN).fill(0),
      mem: 8,
      memLimit: 256,
      networks: ["bridge"],
      mounts: [],
      env: {},
      command: "/docker-entrypoint.sh",
      restarts: 0,
      createdAt: Date.now(),
    };
    setContainers((prev) => [c, ...prev]);
    return c;
  }, []);

  const pruneImages = useCallback(() => {
    const inUse = new Set(containers.map((c) => c.image));
    const removable = images.filter((img) => img.dangling || !inUse.has(`${img.repository}:${img.tag}`));
    const reclaimed = removable.reduce((s, i) => s + i.sizeMb, 0);
    setImages((prev) => prev.filter((img) => !removable.includes(img)));
    return { count: removable.length, reclaimedMb: reclaimed, items: removable };
  }, [containers, images]);

  const pullImage = useCallback((repository: string, tag: string, sizeMb: number) => {
    setImages((prev) => {
      if (prev.some((i) => i.repository === repository && i.tag === tag)) return prev;
      return [{ id: "sha256:" + randomHex(12), repository, tag, sizeMb, createdAt: Date.now(), dangling: false }, ...prev];
    });
  }, []);

  const hasImage = useCallback((repository: string, tag: string) => images.some((i) => i.repository === repository && i.tag === tag), [images]);

  return { containers, images, now, start, stop, restart, remove, runFromImage, pruneImages, pullImage, hasImage };
}

export type FleetApi = ReturnType<typeof useFleet>;

/* ---------- formatting helpers ---------- */
export function formatUptime(startedAt: number | null, now: number) {
  if (!startedAt) return "—";
  let s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(m)}m ${pad(s)}s`;
}

export function formatSize(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.floor((now - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
