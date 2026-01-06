// src/components/builder/WorkflowLauncherModal.tsx
"use client";

import React, { useMemo } from "react";
import { RefreshCw, X } from "lucide-react";

type WorkflowRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at?: string;
  last_opened_at?: string;
  graph?: any; // optional – used for preview
};

type MiniPt = { id: string; x: number; y: number };
type MiniLine = { x1: number; y1: number; x2: number; y2: number };
type MiniEdge = { source: string; target: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function WorkflowLauncherModal({
  open,
  logoSrc = "/brand/edgaze-mark.png",
  continueItems,
  publishedItems,
  onCreateNew,
  onOpen,
  onClose,
  onRefresh,
  errorText,
  busy,
  newForm,
}: {
  open: boolean;
  logoSrc?: string;
  continueItems: WorkflowRow[];
  publishedItems: WorkflowRow[];
  onCreateNew: () => void;
  onOpen: (id: string) => void;
  onClose?: () => void;
  onRefresh?: () => void;
  errorText?: string | null;
  busy?: boolean;
  newForm?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="h-[min(720px,90vh)] w-[min(1180px,94vw)] overflow-hidden rounded-[26px] border border-white/12 bg-black/55 shadow-[0_30px_140px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="Edgaze" className="h-8 w-8" />
            <div className="text-[18px] font-semibold text-white">Workflows</div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10",
                  busy && "cursor-not-allowed opacity-70"
                )}
                disabled={busy}
                title="Refresh"
                type="button"
              >
                <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} />
                Refresh
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                aria-label="Close"
                title="Close"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid h-[calc(100%-72px)] grid-cols-12 gap-6 overflow-hidden p-6">
          <div className="col-span-12 overflow-auto pr-1 md:col-span-4">
            <button
              onClick={onCreateNew}
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-5 py-4 text-left hover:bg-white/10"
              type="button"
            >
              <div className="text-sm font-semibold text-white">New</div>
              <div className="mt-0.5 text-xs text-white/55">
                Start a new workflow
              </div>
            </button>

            {newForm}

            {errorText && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] leading-relaxed text-red-300">
                {errorText}
              </div>
            )}

            <div className="mt-4 text-[12px] leading-relaxed text-white/45">
              Drafts autosave while you edit. Publishing pushes to the marketplace
              later.
            </div>
          </div>

          <div className="col-span-12 overflow-auto pr-1 md:col-span-8">
            <div>
              <div className="mb-3 text-sm font-semibold text-white/90">
                Continue
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {continueItems.length === 0 ? (
                  <div className="text-sm text-white/50">No drafts yet.</div>
                ) : (
                  continueItems.map((w: WorkflowRow) => (
                    <Card
                      key={w.id}
                      title={w.title}
                      meta="Draft"
                      graph={w.graph}
                      onClick={() => onOpen(w.id)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 text-sm font-semibold text-white/90">
                Your workflows
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {publishedItems.length === 0 ? (
                  <div className="text-sm text-white/50">
                    No published workflows yet.
                  </div>
                ) : (
                  publishedItems.map((w: WorkflowRow) => (
                    <Card
                      key={w.id}
                      title={w.title}
                      meta="Published"
                      graph={w.graph}
                      onClick={() => onOpen(w.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  meta,
  graph,
  onClick,
}: {
  title: string;
  meta: string;
  graph?: any;
  onClick: () => void;
}) {
  const summary = useMemo(() => {
    const n = Array.isArray(graph?.nodes) ? graph.nodes.length : 0;
    const e = Array.isArray(graph?.edges) ? graph.edges.length : 0;
    return n === 0 && e === 0 ? "Empty" : `${n} nodes · ${e} edges`;
  }, [graph]);

  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl border border-white/12 bg-black/35 hover:bg-black/25",
        "px-4 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
      )}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {title}
          </div>
          <div className="mt-1 text-xs text-white/55">
            {meta} · {summary}
          </div>
        </div>

        <div className="shrink-0">
          <MiniGraphPreview graph={graph} />
        </div>
      </div>
    </button>
  );
}

function MiniGraphPreview({ graph }: { graph?: any }) {
  const nodes: any[] = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges: any[] = Array.isArray(graph?.edges) ? graph.edges : [];

  const pts: MiniPt[] = nodes.slice(0, 6).map((n: any, i: number): MiniPt => {
    const x = 10 + (i % 3) * 16;
    const y = 10 + Math.floor(i / 3) * 16;
    return { id: String(n?.id ?? i), x, y };
  });

  const byId = new Map<string, MiniPt>(pts.map((p: MiniPt) => [p.id, p]));

  const lines: MiniLine[] = (edges as MiniEdge[])
    .slice(0, 6)
    .flatMap((e: MiniEdge): MiniLine[] => {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) return [];
      return [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }];
    });

  return (
    <div className="h-[44px] w-[64px] overflow-hidden rounded-xl border border-white/12 bg-black/35">
      <svg viewBox="0 0 64 44" className="h-full w-full">
        <defs>
          <linearGradient id="edg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(34,211,238,0.9)" />
            <stop offset="1" stopColor="rgba(232,121,249,0.9)" />
          </linearGradient>
        </defs>

        {lines.map((l: MiniLine, i: number) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
          />
        ))}

        {pts.map((p: MiniPt) => (
          <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="url(#edg)" />
        ))}

        {pts.length === 0 && (
          <rect
            x="10"
            y="14"
            width="44"
            height="16"
            rx="8"
            fill="rgba(255,255,255,0.06)"
          />
        )}
      </svg>
    </div>
  );
}
