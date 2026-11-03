import { useRef, type KeyboardEvent, type UIEvent } from "react";
import type { Token } from "../utils/highlight";
import { cn } from "../utils/cn";

function Lines({ lines, errorLine, activeLine }: { lines: Token[][]; errorLine?: number | null; activeLine?: number | null }) {
  return (
    <>
      {lines.map((toks, i) => (
        <div key={i} className={cn("px-4", errorLine === i + 1 && "bg-rose-500/15", activeLine === i + 1 && errorLine !== i + 1 && "bg-slate-800/40")}>
          {toks.length === 0 ? "\u200b" : toks.map((t, j) => (
            <span key={j} className={t.cls}>
              {t.text}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

function Gutter({ count, errorLine, activeLine, className }: { count: number; errorLine?: number | null; activeLine?: number | null; className?: string }) {
  return (
    <div className={cn("gutter select-none pr-3 pl-3 text-right text-slate-600", className ?? "border-r border-line/70 bg-panel-2/60")} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(errorLine === i + 1 && "text-rose-400 font-semibold", activeLine === i + 1 && "text-slate-300")}>
          {i + 1}
        </div>
      ))}
    </div>
  );
}

/* ---------- Read-only block ---------- */
export function CodeBlock({ lines, className, maxHeight = "none" }: { lines: Token[][]; className?: string; maxHeight?: string }) {
  return (
    <div className={cn("code-editor overflow-auto bg-ink", className)} style={{ maxHeight }}>
      <pre className="flex min-w-max">
        <Gutter count={lines.length} />
        <code className="block flex-1 py-0">
          <Lines lines={lines} />
        </code>
      </pre>
    </div>
  );
}

/* ---------- Editable overlay ---------- */
export function CodeEditor({
  value,
  onChange,
  lines,
  errorLine,
  className,
  height = "520px",
  onCursorLine,
  activeLine,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  lines: Token[][];
  errorLine?: number | null;
  className?: string;
  height?: string;
  onCursorLine?: (line: number) => void;
  activeLine?: number | null;
  placeholder?: string;
}) {
  const preRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = el.scrollTop;
      preRef.current.scrollLeft = el.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    } else if (e.key === "Enter") {
      // keep indentation
      const start = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const current = value.slice(lineStart, start);
      const indent = current.match(/^\s*/)?.[0] ?? "";
      const extra = /:\s*$/.test(current) || /^\s*-\s*$/.test(current) ? "  " : "";
      e.preventDefault();
      const insert = "\n" + indent + extra;
      const next = value.slice(0, start) + insert + value.slice(el.selectionEnd);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length;
      });
    }
  };

  const reportCursor = (el: HTMLTextAreaElement) => {
    if (!onCursorLine) return;
    const line = value.slice(0, el.selectionStart).split("\n").length;
    onCursorLine(line);
  };

  return (
    <div className={cn("code-editor relative flex overflow-hidden bg-ink", className)} style={{ height }}>
      <div ref={gutterRef} className="h-full shrink-0 overflow-hidden border-r border-line/70 bg-panel-2/60">
        <div className="pb-6">
          <Gutter count={Math.max(lines.length, 1)} errorLine={errorLine} activeLine={activeLine} className="" />
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <div ref={preRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <pre className="min-w-max pb-6">
            <Lines lines={lines} errorLine={errorLine} activeLine={activeLine} />
          </pre>
        </div>
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            reportCursor(e.target);
          }}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => reportCursor(e.currentTarget)}
          onClick={(e) => reportCursor(e.currentTarget)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          placeholder={placeholder}
          className="absolute inset-0 h-full w-full overflow-auto px-4 pb-6"
          aria-label="Code editor"
        />
      </div>
    </div>
  );
}
