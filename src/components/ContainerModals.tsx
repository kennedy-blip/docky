import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Pause, Play, ScrollText, Search, Terminal, Trash2 } from "lucide-react";
import type { Container, LogLine } from "../types";
import { generateLog, seedLogs } from "../data/mock";
import { Badge, Button, Modal, inputCls } from "./ui";
import { cn } from "../utils/cn";
import { useToast } from "../context/ToastContext";

/* =====================================================================
   LOGS
   ===================================================================== */
const levelCls: Record<LogLine["level"], string> = {
  INFO: "text-sky-300",
  WARN: "text-amber-300",
  ERROR: "text-rose-300",
  DEBUG: "text-slate-500",
};

export function LogsModal({ container, onClose }: { container: Container | null; onClose: () => void }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [q, setQ] = useState("");
  const [levels, setLevels] = useState<Record<LogLine["level"], boolean>>({ INFO: true, WARN: true, ERROR: true, DEBUG: true });
  const bodyRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const name = container?.name;
  const status = container?.status;

  useEffect(() => {
    if (!name) return;
    setLines(seedLogs(name));
    setPaused(false);
    setQ("");
  }, [name]);

  useEffect(() => {
    if (!name || paused || status !== "running") return;
    const t = window.setInterval(() => {
      const l = generateLog(name);
      setLines((prev) => [...prev.slice(-400), { ts: Date.now(), ...l }]);
    }, 900 + Math.random() * 1200);
    return () => window.clearInterval(t);
  }, [name, paused, status]);

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines, follow]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return lines.filter((l) => levels[l.level] && (!s || l.msg.toLowerCase().includes(s)));
  }, [lines, q, levels]);

  const download = () => {
    const text = lines.map((l) => `${new Date(l.ts).toISOString()} [${l.level}] ${l.msg}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Logs downloaded", `${name}.log · ${lines.length} lines`);
  };

  if (!container) return null;
  const errs = lines.filter((l) => l.level === "ERROR").length;

  return (
    <Modal
      open={!!container}
      onClose={onClose}
      size="xl"
      icon={<ScrollText className="h-4 w-4" />}
      title={
        <span className="flex items-center gap-2">
          Logs · <span className="font-mono">{container.name}</span>
          {status === "running" && !paused && (
            <Badge tone="green" dot pulse>
              streaming
            </Badge>
          )}
          {status !== "running" && <Badge tone="slate">container {status}</Badge>}
        </span>
      }
      subtitle={<span className="font-mono">docker logs -f --tail 200 {container.id}</span>}
    >
      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="grep…" className={cn(inputCls, "h-8 py-1 pl-8 font-mono text-xs")} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(levels) as LogLine["level"][]).map((lv) => (
            <button
              key={lv}
              onClick={() => setLevels((s) => ({ ...s, [lv]: !s[lv] }))}
              className={cn("rounded-md border px-2 py-1 font-mono text-[10px] transition", levels[lv] ? "border-line-2 bg-panel-2 " + levelCls[lv] : "border-transparent text-slate-600 line-through")}
            >
              {lv}
            </button>
          ))}
          <Button size="xs" variant={paused ? "success" : "secondary"} icon={paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />} onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="xs" variant={follow ? "outline" : "secondary"} icon={<ArrowDownToLine className="h-3 w-3" />} onClick={() => setFollow((f) => !f)}>
            Follow
          </Button>
          <Button size="xs" variant="ghost" icon={<Trash2 className="h-3 w-3" />} onClick={() => setLines([])}>
            Clear
          </Button>
          <Button size="xs" variant="primary" icon={<ArrowDownToLine className="h-3 w-3" />} onClick={download}>
            Save
          </Button>
        </div>
      </div>
      <div
        ref={bodyRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (!atBottom && follow) setFollow(false);
        }}
        className="h-[55vh] overflow-auto bg-ink p-4 font-mono text-[11.5px] leading-relaxed"
      >
        {filtered.length === 0 ? (
          <div className="text-slate-600">— no log lines —</div>
        ) : (
          filtered.map((l, i) => (
            <div key={`${l.ts}-${i}`} className="flex gap-3 whitespace-pre-wrap break-all hover:bg-slate-800/40">
              <span className="shrink-0 text-slate-600">{new Date(l.ts).toISOString().slice(11, 23)}</span>
              <span className={cn("w-12 shrink-0 font-semibold", levelCls[l.level])}>{l.level}</span>
              <span className={cn(l.level === "ERROR" ? "text-rose-200" : l.level === "DEBUG" ? "text-slate-400" : "text-slate-200")}>{l.msg}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-2 font-mono text-[10px] text-slate-500">
        <span>
          {filtered.length} / {lines.length} lines · {errs} errors
        </span>
        <span>{paused ? "paused" : status === "running" ? "tailing stdout+stderr" : "process not running"}</span>
      </div>
    </Modal>
  );
}

/* =====================================================================
   SHELL
   ===================================================================== */
interface TermLine {
  kind: "cmd" | "out" | "err";
  text: string;
}

const osRelease = (image: string) =>
  /alpine/.test(image)
    ? `NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.19.0\nPRETTY_NAME="Alpine Linux v3.19"\nHOME_URL="https://alpinelinux.org/"`
    : `PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nID=debian`;

function workdirFor(c: Container) {
  if (/postgres/.test(c.image)) return "/var/lib/postgresql";
  if (/redis/.test(c.image)) return "/data";
  if (/nginx/.test(c.image)) return "/etc/nginx";
  if (/grafana/.test(c.image)) return "/usr/share/grafana";
  if (/prometheus/.test(c.image)) return "/prometheus";
  return "/app";
}

function userFor(c: Container) {
  if (/postgres/.test(c.image)) return "postgres";
  if (/dockerpulse/.test(c.image)) return "node";
  if (/grafana/.test(c.image)) return "grafana";
  if (/prometheus/.test(c.image)) return "nobody";
  return "root";
}

function lsFor(c: Container, long: boolean) {
  const files: Record<string, string[]> = {
    "/app": ["dist", "node_modules", "package.json", "package-lock.json", "uploads", ".env"],
    "/var/lib/postgresql": ["data"],
    "/data": ["appendonlydir", "dump.rdb"],
    "/etc/nginx": ["conf.d", "certs", "mime.types", "nginx.conf", "fastcgi_params"],
    "/usr/share/grafana": ["bin", "conf", "public", "LICENSE", "VERSION"],
    "/prometheus": ["chunks_head", "wal", "queries.active", "lock"],
  };
  const list = files[workdirFor(c)] ?? ["bin", "etc", "usr", "var"];
  if (!long) return list.join("  ");
  const u = userFor(c);
  return (
    `total ${list.length * 4}\n` +
    list
      .map((f) => {
        const dir = !f.includes(".") || f === "node_modules";
        return `${dir ? "drwxr-xr-x" : "-rw-r--r--"}  1 ${u.padEnd(8)} ${u.padEnd(8)} ${String(dir ? 4096 : 100 + f.length * 37).padStart(6)} Jan 15 10:22 ${f}`;
      })
      .join("\n")
  );
}

function runCommand(raw: string, c: Container): { out: string; err?: boolean; clear?: boolean; exit?: boolean } {
  const input = raw.trim();
  if (!input) return { out: "" };
  const [cmd, ...args] = input.split(/\s+/);
  const wd = workdirFor(c);
  switch (cmd) {
    case "help":
      return { out: "Simulated shell. Try: ls, ls -la, pwd, whoami, env, ps, top, cat /etc/os-release, hostname, uname -a, df -h, free -m, uptime, date, ss -tlnp, echo, clear, exit" };
    case "ls":
      return { out: lsFor(c, args.includes("-la") || args.includes("-l") || args.includes("-al")) };
    case "pwd":
      return { out: wd };
    case "cd":
      return { out: "" };
    case "whoami":
      return { out: userFor(c) };
    case "id": {
      const u = userFor(c);
      return { out: u === "root" ? "uid=0(root) gid=0(root) groups=0(root)" : `uid=1000(${u}) gid=1000(${u}) groups=1000(${u})` };
    }
    case "hostname":
      return { out: c.id };
    case "uname":
      return { out: args.includes("-a") ? `Linux ${c.id} 6.5.0-14-generic #14-Ubuntu SMP x86_64 GNU/Linux` : "Linux" };
    case "date":
      return { out: new Date().toUTCString() };
    case "uptime": {
      const s = c.startedAt ? Math.floor((Date.now() - c.startedAt) / 1000) : 0;
      return { out: ` ${new Date().toTimeString().slice(0, 8)} up ${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}, load average: ${(c.cpu / 25).toFixed(2)}, ${(c.cpu / 30).toFixed(2)}, ${(c.cpu / 35).toFixed(2)}` };
    }
    case "env":
    case "printenv":
      return {
        out: [`PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`, `HOSTNAME=${c.id}`, `HOME=/${userFor(c) === "root" ? "root" : "home/" + userFor(c)}`, `PWD=${wd}`, ...Object.entries(c.env).map(([k, v]) => `${k}=${v}`)].join("\n"),
      };
    case "ps":
      return {
        out: `PID   USER     TIME  COMMAND\n    1 ${userFor(c).padEnd(8)} ${String(Math.floor(c.cpu * 7)).padStart(2)}:${String(Math.floor(c.cpu * 3) % 60).padStart(2, "0")} ${c.command}\n   ${27 + (parseInt(c.id.slice(0, 2), 16) % 50)} ${userFor(c).padEnd(8)}  0:00 sh\n   ${99 + (parseInt(c.id.slice(2, 4), 16) % 50)} ${userFor(c).padEnd(8)}  0:00 ps`,
      };
    case "top":
      return {
        out: `Mem: ${Math.round(c.mem * 1024)}K used, ${Math.round((c.memLimit - c.mem) * 1024)}K free\nCPU: ${c.cpu.toFixed(0)}% usr   1% sys   0% nic  ${(99 - c.cpu).toFixed(0)}% idle\n  PID  PPID USER     STAT   VSZ %VSZ %CPU COMMAND\n    1     0 ${userFor(c).padEnd(8)} S    ${Math.round(c.mem)}m  ${((c.mem / c.memLimit) * 100).toFixed(0)}%  ${c.cpu.toFixed(0)}% ${c.command}`,
      };
    case "df":
      return { out: `Filesystem      Size  Used Avail Use% Mounted on\noverlay          59G   21G   36G  37% /\ntmpfs            64M     0   64M   0% /dev\nshm              64M     0   64M   0% /dev/shm${c.mounts.map((m) => `\n/dev/vda1        59G   21G   36G  37% ${m.split(":")[1] ?? m}`).join("")}` };
    case "free":
      return { out: `              total        used        free      shared\nMem:        ${String(c.memLimit).padStart(8)}    ${String(Math.round(c.mem)).padStart(8)}    ${String(Math.round(c.memLimit - c.mem)).padStart(8)}           0\nSwap:              0           0           0` };
    case "ss":
    case "netstat":
      return {
        out: `State   Recv-Q  Send-Q  Local Address:Port   Peer Address:Port  Process\n` + (c.ports.length ? c.ports.map((p) => `LISTEN  0       128     0.0.0.0:${p.container}        0.0.0.0:*          users:(("${c.command.split(" ")[0]}",pid=1))`).join("\n") : "(no listening sockets)"),
      };
    case "cat": {
      const f = args[0];
      if (!f) return { out: "cat: missing operand", err: true };
      if (f === "/etc/os-release") return { out: osRelease(c.image) };
      if (f === "/etc/hostname") return { out: c.id };
      if (f === "/etc/hosts") return { out: `127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost\n172.18.0.${(parseInt(c.id.slice(0, 2), 16) % 200) + 2}\t${c.id}` };
      if (f === "package.json" && wd === "/app") return { out: `{\n  "name": "${c.name}",\n  "version": "2.4.1",\n  "scripts": { "start": "${c.command}" }\n}` };
      if (f === ".env" && wd === "/app") return { out: Object.entries(c.env).map(([k, v]) => `${k}=${v}`).join("\n") };
      return { out: `cat: can't open '${f}': No such file or directory`, err: true };
    }
    case "echo":
      return { out: args.join(" ").replace(/\$HOSTNAME/g, c.id).replace(/\$HOME/g, "/root") };
    case "clear":
      return { out: "", clear: true };
    case "exit":
      return { out: "", exit: true };
    case "docker":
      return { out: "sh: docker: not found (you're inside the container 🐳)", err: true };
    case "sudo":
      return { out: "sh: sudo: not found", err: true };
    case "apk":
    case "apt":
    case "apt-get":
      return { out: userFor(c) === "root" ? `${cmd}: package index is read-only in this simulated shell` : `ERROR: Unable to lock database: Permission denied`, err: userFor(c) !== "root" };
    case "node":
      return { out: args.includes("-v") || args.includes("--version") ? "v20.11.0" : "Welcome to Node.js v20.11.0.\n(interactive REPL not available in simulated shell)" };
    case "python":
    case "python3":
      return { out: "Python 3.11.7" };
    case "nginx":
      return { out: args.includes("-t") ? "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful" : "nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address in use)", err: !args.includes("-t") };
    case "psql":
      return { out: "psql (15.5)\nType \"help\" for help.\n\n(interactive session not available in simulated shell)" };
    case "redis-cli":
      return { out: args.join(" ") === "ping" ? "PONG" : args[0] === "info" ? "# Server\nredis_version:7.2.3\nuptime_in_seconds:" + Math.floor((Date.now() - (c.startedAt ?? Date.now())) / 1000) : "(error) interactive session not available in simulated shell" };
    default:
      return { out: `sh: ${cmd}: not found`, err: true };
  }
}

export function ShellModal({ container, onClose }: { container: Container | null; onClose: () => void }) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const id = container?.id;

  useEffect(() => {
    if (!id || !container) return;
    setLines([
      { kind: "out", text: `$ docker exec -it ${container.name} sh` },
      { kind: "out", text: `Connected to ${container.id} (${container.image}). Type 'help' for available commands.` },
    ]);
    setInput("");
    setHistory([]);
    setHIdx(-1);
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  const prompt = container ? `${userFor(container)}@${container.id.slice(0, 12)}:${workdirFor(container)}${userFor(container) === "root" ? "#" : "$"}` : "$";

  const submit = useCallback(() => {
    if (!container) return;
    const res = runCommand(input, container);
    if (res.exit) {
      onClose();
      return;
    }
    if (res.clear) {
      setLines([]);
    } else {
      setLines((prev) => [...prev, { kind: "cmd", text: `${prompt} ${input}` }, ...(res.out ? [{ kind: res.err ? ("err" as const) : ("out" as const), text: res.out }] : [])]);
    }
    if (input.trim()) setHistory((h) => [input, ...h].slice(0, 50));
    setHIdx(-1);
    setInput("");
  }, [container, input, prompt, onClose]);

  if (!container) return null;

  return (
    <Modal open={!!container} onClose={onClose} size="lg" icon={<Terminal className="h-4 w-4" />} title={<span>Inspect Shell · <span className="font-mono">{container.name}</span></span>} subtitle={<span className="font-mono">docker exec -it {container.id} sh</span>}>
      <div className="bg-ink" onClick={() => inputRef.current?.focus()}>
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 font-mono text-[10px] text-slate-500">
            sh — {container.image} — {userFor(container)}
          </span>
        </div>
        <div ref={bodyRef} className="h-[50vh] overflow-auto p-4 font-mono text-[12px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className={cn("whitespace-pre-wrap break-all", l.kind === "cmd" ? "text-slate-100" : l.kind === "err" ? "text-rose-300" : "text-slate-300")}>
              {l.kind === "cmd" ? (
                <>
                  <span className="text-emerald-400">{l.text.split(" ")[0]}</span> {l.text.split(" ").slice(1).join(" ")}
                </>
              ) : (
                l.text
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-emerald-400">{prompt}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const ni = Math.min(history.length - 1, hIdx + 1);
                  setHIdx(ni);
                  setInput(history[ni] ?? "");
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const ni = Math.max(-1, hIdx - 1);
                  setHIdx(ni);
                  setInput(ni === -1 ? "" : history[ni]);
                } else if (e.key === "l" && e.ctrlKey) {
                  e.preventDefault();
                  setLines([]);
                }
              }}
              className="flex-1 bg-transparent font-mono text-[12px] text-slate-100 caret-sky-400 outline-none"
              spellCheck={false}
              autoComplete="off"
              aria-label="Shell input"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2">
          {["ls -la", "env", "ps", "cat /etc/os-release", "ss -tlnp", "top", "help"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                inputRef.current?.focus();
              }}
              className="rounded border border-line-2 bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-slate-400 transition hover:border-cyber/50 hover:text-sky-200"
            >
              {s}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-slate-600">↑/↓ history · ctrl+l clear · exit</span>
        </div>
      </div>
    </Modal>
  );
}
