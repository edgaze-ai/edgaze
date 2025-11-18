"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { listNodeSpecs } from "src/nodes/registry";
import type { NodeSpec } from "src/nodes/types";
import { Search, Sparkles, Plus, ExternalLink } from "lucide-react";

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function PreviewCard({ spec, onDragStart }: { spec: NodeSpec; onDragStart: (e: React.DragEvent) => void }) {
  const stage = useElementSize<HTMLDivElement>();
  const innerWidth = Math.max(220, Math.min(420, stage.size.width - 24));
  return (
    <div ref={stage.ref} className="preview-stage edgaze-no-select">
      <div
        className="edge-card rounded-[12px] overflow-hidden preview-card"
        style={{ width: `${innerWidth}px` }}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div className="edge-card-header text-[12px] py-1.5">
          <span className="truncate">{spec.label}</span>
          <span className="text-[10px] opacity-70">{spec.version ?? "1.0.0"}</span>
        </div>
        <div className="edge-card-body text-[11px] py-1.5">
          <div className="opacity-85 line-clamp-1">{spec.summary}</div>
        </div>
      </div>
    </div>
  );
}

function QuickStartItem({ icon, title, caption, href = "#" }: { icon: React.ReactNode; title: string; caption: string; href?: string }) {
  return (
    <a href={href} className="flex items-center gap-4 rounded-2xl px-4 py-3 edge-glass edge-border bg-black/25 hover:bg-white/5 transition-colors overflow-hidden">
      <div className="grid place-items-center h-10 w-10 rounded-xl bg-white/[0.04]">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold">{title}</div>
          <ExternalLink size={14} className="opacity-60" />
        </div>
        <div className="text-xs opacity-70 truncate">{caption}</div>
      </div>
    </a>
  );
}

export default function BlockLibrary({ onAdd }: { onAdd?: (specId: string) => void }) {
  const [q, setQ] = useState("");
  const [showQS, setShowQS] = useState(true);

  const all = listNodeSpecs();
  const items = useMemo(() => {
    if (!q) return all;
    const term = q.toLowerCase();
    return all.filter((s) => `${s.label} ${s.id} ${s.summary}`.toLowerCase().includes(term));
  }, [q, all]);

  const handleAdd = (specId: string) => {
    window.dispatchEvent(new CustomEvent("edgaze:add-node", { detail: { specId, source: "library" } }));
    onAdd?.(specId);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 pt-2">
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blocks..."
            className="w-full rounded-xl bg-[#111111]/60 edge-border pl-9 pr-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <button className="w-full rounded-[14px] p-[1.5px] edgaze-flow mb-2" title="Search nodes with AI" type="button">
          <div className="w-full rounded-[12px] bg-[#121212] px-4 py-3 text-sm flex items-center justify-center gap-2">
            <Sparkles size={16} /> Search nodes with AI
          </div>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-5 -mr-4 pb-6 library-scroll">
        <div className="px-2">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs tracking-widest opacity-80">QUICK START</h4>
            <button onClick={() => setShowQS((s) => !s)} className="text-xs opacity-70 hover:opacity-100" type="button">
              {showQS ? "Hide" : "Show"}
            </button>
          </div>
          {showQS && (
            <div className="grid gap-3">
              <QuickStartItem icon={<span className="text-lg">📧</span>} title="Email Parser" caption="Turn emails into structured data." />
              <QuickStartItem icon={<span className="text-lg">✍️</span>} title="Writer" caption="Generate posts with AI." />
              <QuickStartItem icon={<span className="text-lg">🎨</span>} title="Images" caption="Text-to-image generation." />
            </div>
          )}
        </div>

        <div className="px-2 mt-6 space-y-4">
          {items.map((spec) => {
            const onDragStart = (e: React.DragEvent) => {
              e.dataTransfer.setData("application/edgaze-node", JSON.stringify({ specId: spec.id }));
              e.dataTransfer.effectAllowed = "move";
            };
            return (
              <div key={spec.id} className="rounded-2xl p-4 edge-glass edge-border bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{spec.label}</div>
                  <span className="text-xs opacity-60">{spec.id}</span>
                </div>

                <div className="mt-3">
                  <PreviewCard spec={spec} onDragStart={onDragStart} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs opacity-70">
                    {spec.ports.filter((p) => p.kind === "input").length} in · {spec.ports.filter((p) => p.kind === "output").length} out
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(spec.id)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs edge-glass edge-border hover:bg-white/10 transition-colors"
                    title="Add to canvas"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-6" />
      </div>

      <style jsx global>{`
        .edgaze-no-select { user-select: none; }
        .preview-stage {
          width: 100%; padding: 12px; display: grid; place-items: center;
          border-radius: 12px; overflow: hidden;
          background: radial-gradient(transparent 1px, rgba(255,255,255,0.02) 1px);
          background-size: 12px 12px;
        }
        .preview-card { cursor: grab; } .preview-card:active { cursor: grabbing; }
        .edgaze-flow {
          background: linear-gradient(90deg,#78e9ff,#b68cff,#ff6db2,#78e9ff);
          background-size: 300% 100%;
          animation: edgaze-move 8s linear infinite;
        }
        @keyframes edgaze-move { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
        .library-scroll { scrollbar-gutter: stable both-edges; }
        .library-scroll::-webkit-scrollbar { width: 8px; }
        .library-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 9999px; }
        .library-scroll::-webkit-scrollbar-track { background: transparent !important; }
      `}</style>
    </div>
  );
}
