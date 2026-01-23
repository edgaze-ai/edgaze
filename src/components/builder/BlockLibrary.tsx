"use client";

import { useMemo, useState, useEffect, useRef, memo } from "react";
import { listNodeSpecs } from "src/nodes/registry";
import type { NodeSpec } from "src/nodes/types";
import { Search, Sparkles, Plus, ExternalLink } from "lucide-react";

/* ---------- Size hook (kept as-is, just used for preview width) ---------- */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

/* ---------- Compact preview card shown inside each block ---------- */
function PreviewCard({
  spec,
  onDragStart,
}: {
  spec: NodeSpec;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const stage = useElementSize<HTMLDivElement>();

  // slightly narrower and shorter
  const innerWidth = Math.max(200, Math.min(340, stage.size.width - 18));

  return (
    <div ref={stage.ref} className="preview-stage edgaze-no-select">
      <div
        className="edge-card preview-card overflow-hidden rounded-xl text-[11px] leading-snug"
        style={{ width: `${innerWidth}px` }}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div className="edge-card-header px-3 py-1.5 text-[11px]">
          <span className="truncate">{spec.label}</span>
          <span className="text-[10px] opacity-70">
            {spec.version ?? "1.0.0"}
          </span>
        </div>
        <div className="edge-card-body px-3 py-1.5 text-[10px]">
          <div className="line-clamp-1 opacity-80">{spec.summary}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Quick-start pill ---------- */
function QuickStartItem({
  icon,
  title,
  caption,
  href = "#",
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 edge-glass edge-border text-[12px] hover:bg-white/5 transition-colors overflow-hidden"
    >
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="font-semibold text-[12px]">{title}</div>
          <ExternalLink size={13} className="opacity-60" />
        </div>
        <div className="truncate text-[11px] opacity-70">{caption}</div>
      </div>
    </a>
  );
}

/* ---------- Block library ---------- */
function BlockLibrary({
  onAdd,
}: {
  onAdd?: (specId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [showQS, setShowQS] = useState(true);

  const all = listNodeSpecs();
  const items = useMemo(() => {
    if (!q) return all;
    const term = q.toLowerCase();
    return all.filter((s) =>
      `${s.label} ${s.id} ${s.summary}`.toLowerCase().includes(term)
    );
  }, [q, all]);

  const handleAdd = (specId: string) => {
    // keep existing behaviour – do NOT change event name
    window.dispatchEvent(
      new CustomEvent("edgaze:add-node", { detail: { specId, source: "library" } })
    );
    onAdd?.(specId);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search + AI button */}
      <div className="px-2 pt-2">
        <div className="relative mb-1.5">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blocks..."
            className="w-full rounded-lg bg-[#111111]/60 edge-border py-1.5 pl-8 pr-3 text-[12px] focus:outline-none"
          />
        </div>

        <button
          className="edgaze-flow mb-2 w-full rounded-[12px] p-[1.2px]"
          title="Search nodes with AI"
          type="button"
        >
          <div className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#121212] px-3 py-2 text-[12px]">
            <Sparkles size={15} />
            <span>Search nodes with AI</span>
          </div>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="library-scroll -mr-3 flex-1 min-h-0 overflow-y-auto pr-4 pb-5">
        {/* Quick start */}
        <div className="px-2 pt-1">
          <div className="mb-1.5 flex items-center justify-between">
            <h4 className="text-[11px] tracking-[0.18em] text-white/70">
              QUICK START
            </h4>
            <button
              onClick={() => setShowQS((s) => !s)}
              className="text-[11px] opacity-70 hover:opacity-100"
              type="button"
            >
              {showQS ? "Hide" : "Show"}
            </button>
          </div>
          {showQS && (
            <div className="grid gap-2.5">
              <QuickStartItem
                icon={<span className="text-[15px]">📧</span>}
                title="Email Parser"
                caption="Turn emails into structured data."
              />
              <QuickStartItem
                icon={<span className="text-[15px]">✍️</span>}
                title="Writer"
                caption="Generate posts with AI."
              />
              <QuickStartItem
                icon={<span className="text-[15px]">🎨</span>}
                title="Images"
                caption="Text-to-image generation."
              />
            </div>
          )}
        </div>

        {/* Node list */}
        <div className="mt-5 space-y-3 px-2">
          {items.map((spec) => {
            const onDragStart = (e: React.DragEvent) => {
              e.dataTransfer.setData(
                "application/edgaze-node",
                JSON.stringify({ specId: spec.id })
              );
              e.dataTransfer.effectAllowed = "move";
            };

            const inputs = spec.ports.filter((p) => p.kind === "input").length;
            const outputs = spec.ports.filter((p) => p.kind === "output").length;

            return (
              <div
                key={spec.id}
                className="rounded-xl bg-black/20 p-3 edge-glass edge-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {spec.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/55 line-clamp-1">
                      {spec.summary}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-white/45">
                    {spec.id}
                  </span>
                </div>

                <div className="mt-2">
                  <PreviewCard spec={spec} onDragStart={onDragStart} />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <div className="text-white/55">
                    {inputs} in · {outputs} out
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(spec.id)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] edge-glass edge-border hover:bg-white/10 transition-colors"
                    title="Add to canvas"
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-3" />
      </div>

      {/* Global tweaks for the library visuals (compact, scroll-friendly) */}
      <style jsx global>{`
        .edgaze-no-select {
          user-select: none;
        }

        .preview-stage {
          width: 100%;
          padding: 8px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          overflow: hidden;
          background: radial-gradient(
            transparent 1px,
            rgba(255, 255, 255, 0.018) 1px
          );
          background-size: 10px 10px;
        }

        .preview-card {
          cursor: grab;
        }
        .preview-card:active {
          cursor: grabbing;
        }

        .edgaze-flow {
          background: linear-gradient(
            90deg,
            #78e9ff,
            #b68cff,
            #ff6db2,
            #78e9ff
          );
          background-size: 260% 100%;
          animation: edgaze-move 9s linear infinite;
        }

        @keyframes edgaze-move {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 260% 50%;
          }
        }

        .library-scroll {
          scrollbar-gutter: stable both-edges;
        }
        .library-scroll::-webkit-scrollbar {
          width: 7px;
        }
        .library-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 9999px;
        }
        .library-scroll::-webkit-scrollbar-track {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}

export default memo(BlockLibrary);
