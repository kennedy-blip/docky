import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Graph, GraphNode } from "../utils/compose";
import { cn } from "../utils/cn";

const colors = {
  service: { fill: "#0c1a2e", stroke: "#0284c7", text: "#e0f2fe", glow: "rgba(56,189,248,0.45)" },
  network: { fill: "#15152e", stroke: "#6366f1", text: "#e0e7ff", glow: "rgba(99,102,241,0.45)" },
  volume: { fill: "#0b2019", stroke: "#10b981", text: "#d1fae5", glow: "rgba(16,185,129,0.45)" },
};

const edgeColors = { depends: "#38bdf8", network: "#818cf8", volume: "#34d399" };

export function TopologyGraph({ graph, selected, onSelect, className }: { graph: Graph; selected: string | null; onSelect: (id: string | null) => void; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  // reset manual positions when the set of nodes changes
  const signature = graph.nodes.map((n) => n.id).join("|");
  useEffect(() => setPos({}), [signature]);

  const nodes = useMemo(() => graph.nodes.map((n) => ({ ...n, ...(pos[n.id] ?? {}) })), [graph.nodes, pos]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const focus = hover ?? selected;
  const connected = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    graph.edges.forEach((e) => {
      if (e.from === focus) s.add(e.to);
      if (e.to === focus) s.add(e.from);
    });
    return s;
  }, [focus, graph.edges]);

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: RPointerEvent<SVGGElement>, n: GraphNode) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, moved: false };
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const p = toSvg(e);
    const { id, dx, dy } = drag.current;
    drag.current.moved = true;
    setPos((prev) => ({ ...prev, [id]: { x: Math.max(60, Math.min(graph.width - 60, p.x - dx)), y: Math.max(30, Math.min(graph.height - 30, p.y - dy)) } }));
  };
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const { id, moved } = drag.current;
    drag.current = null;
    if (!moved) onSelect(selected === id ? null : id);
    else e.stopPropagation();
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${graph.width} ${graph.height}`}
      className={cn("h-auto w-full touch-none select-none", className)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => (drag.current = null)}
      onClick={() => onSelect(null)}
      role="img"
      aria-label="Compose service topology"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* edges */}
      <g>
        {graph.edges.map((e) => {
          const a = byId[e.from];
          const b = byId[e.to];
          if (!a || !b) return null;
          const dim = connected ? !(connected.has(e.from) && connected.has(e.to) && (e.from === focus || e.to === focus)) : false;
          const color = edgeColors[e.kind];
          // anchor top/bottom depending on relative y
          const down = b.y > a.y;
          const x1 = a.x;
          const y1 = down ? a.y + a.h / 2 : a.y - a.h / 2;
          const x2 = b.x;
          const y2 = down ? b.y - b.h / 2 : b.y + b.h / 2;
          const cy = (y1 + y2) / 2;
          const d = Math.abs(y1 - y2) < 8 ? `M${x1},${y1} C${x1},${y1 + 60} ${x2},${y2 + 60} ${x2},${y2}` : `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
          const mx = (x1 + x2) / 2;
          const my = Math.abs(y1 - y2) < 8 ? y1 + 45 : cy;
          return (
            <g key={e.id} className="transition-opacity duration-200" opacity={dim ? 0.12 : 1}>
              <path d={d} fill="none" stroke={color} strokeWidth={e.kind === "depends" ? 2 : 1.5} strokeDasharray={e.kind === "network" ? "5 5" : e.kind === "volume" ? "2 4" : undefined} markerEnd={e.kind === "depends" ? "url(#arrow)" : undefined} className={cn(e.kind === "network" && !dim && "animate-dash")} opacity={e.kind === "depends" ? 0.95 : 0.7} />
              {e.label && !dim && focus && (
                <g>
                  <rect x={mx - e.label.length * 3.1 - 4} y={my - 8} width={e.label.length * 6.2 + 8} height={16} rx={4} fill="#090d16" stroke={color} strokeOpacity={0.5} />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" fill={color}>
                    {e.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* nodes */}
      <g>
        {nodes.map((n) => {
          const c = colors[n.kind];
          const isFocus = focus === n.id;
          const dim = connected ? !connected.has(n.id) : false;
          const isSelected = selected === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x - n.w / 2}, ${n.y - n.h / 2})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => onDown(e, n)}
              onClick={(e) => e.stopPropagation()}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(null)}
              opacity={dim ? 0.3 : 1}
              style={{ transition: "opacity 200ms" }}
            >
              {n.kind === "network" ? (
                <rect width={n.w} height={n.h} rx={n.h / 2} fill={c.fill} stroke={c.stroke} strokeWidth={isSelected ? 2.5 : 1.5} filter={isFocus ? "url(#glow)" : undefined} />
              ) : n.kind === "volume" ? (
                <g>
                  <rect width={n.w} height={n.h} rx={8} fill={c.fill} stroke={c.stroke} strokeWidth={isSelected ? 2.5 : 1.5} filter={isFocus ? "url(#glow)" : undefined} />
                  <ellipse cx={n.w / 2} cy={0} rx={n.w / 2} ry={5} fill={c.fill} stroke={c.stroke} strokeWidth={1.2} />
                </g>
              ) : (
                <rect width={n.w} height={n.h} rx={10} fill={c.fill} stroke={c.stroke} strokeWidth={isSelected ? 2.5 : 1.5} filter={isFocus ? "url(#glow)" : undefined} />
              )}
              {n.kind === "service" && (
                <g transform="translate(12, 17)">
                  <rect width="12" height="12" rx="2" fill="none" stroke={c.stroke} strokeWidth="1.4" />
                  <path d="M2 4h8M4 1v3M8 1v3" stroke={c.stroke} strokeWidth="1.2" />
                </g>
              )}
              {n.kind === "network" && <circle cx="18" cy={n.h / 2} r="4" fill={c.stroke} opacity={0.9} />}
              {n.kind === "volume" && (
                <g transform={`translate(12, ${n.h / 2 - 6})`}>
                  <path d="M1 2.5h10M1 6h10M1 9.5h10" stroke={c.stroke} strokeWidth="1.4" strokeLinecap="round" />
                </g>
              )}
              <text x={n.kind === "service" ? 32 : 30} y={n.kind === "service" ? 24 : n.h / 2 + (n.sub ? -1 : 4)} fontSize="12" fontWeight={600} fill={c.text} fontFamily="JetBrains Mono, monospace">
                {n.label.length > 17 ? n.label.slice(0, 16) + "…" : n.label}
              </text>
              {n.sub && (
                <text x={n.kind === "service" ? 32 : 30} y={n.kind === "service" ? 41 : n.h / 2 + 11} fontSize="9" fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                  {n.sub.length > 22 ? n.sub.slice(0, 21) + "…" : n.sub}
                </text>
              )}
              {isSelected && <rect x={-4} y={-4} width={n.w + 8} height={n.h + 8} rx={n.kind === "network" ? n.h / 2 + 4 : 13} fill="none" stroke={c.stroke} strokeOpacity={0.5} strokeDasharray="4 3" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
