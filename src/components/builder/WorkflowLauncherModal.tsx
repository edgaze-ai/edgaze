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
      <div className="h-[min(720px,90vh)] w-[min(1180px,94vw)] overflow-hidden rounded-[28px] border border-gray-700/40 bg-black/90 backdrop-blur-2xl shadow-[0_40px_160px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-gray-700/30 bg-black/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black/40 border border-gray-700/40 grid place-items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Edgaze" className="h-5 w-5" />
            </div>
            <div className="text-[18px] font-semibold text-white tracking-tight">Workflows</div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border border-gray-700/40 bg-black/40 px-4 py-2 text-[12px] text-gray-300 hover:bg-black/60 hover:text-white hover:border-gray-600/50 transition-all duration-200",
                  busy && "cursor-not-allowed opacity-50"
                )}
                disabled={busy}
                title="Refresh"
                type="button"
              >
                <RefreshCw className={cx("h-3.5 w-3.5", busy && "animate-spin")} />
                Refresh
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-xl border border-gray-700/40 bg-black/40 text-gray-300 hover:bg-black/60 hover:text-white hover:border-gray-600/50 transition-all duration-200"
                aria-label="Close"
                title="Close"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid h-[calc(100%-80px)] grid-cols-12 gap-6 overflow-hidden p-6">
          <div className="col-span-12 overflow-auto pr-1 md:col-span-4">
            <button
              onClick={onCreateNew}
              className="w-full rounded-xl border border-gray-700/40 bg-black/40 hover:bg-black/60 hover:border-gray-600/50 px-5 py-4 text-left transition-all duration-200 group"
              type="button"
            >
              <div className="text-sm font-semibold text-white group-hover:text-white">New</div>
              <div className="mt-0.5 text-xs text-gray-400 group-hover:text-gray-300">
                Start a new workflow
              </div>
            </button>

            {newForm}

            {errorText && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] leading-relaxed text-red-300/90 backdrop-blur-sm">
                {errorText}
              </div>
            )}

            <div className="mt-4 text-[12px] leading-relaxed text-gray-400 font-medium">
              Drafts autosave while you edit. Publishing pushes to the marketplace
              later.
            </div>
          </div>

          <div className="col-span-12 overflow-auto pr-1 md:col-span-8">
            <div>
              <div className="mb-4 text-sm font-semibold text-white tracking-tight">
                Continue
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {continueItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No drafts yet.</div>
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

            <div className="mt-8">
              <div className="mb-4 text-sm font-semibold text-white tracking-tight">
                Your workflows
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {publishedItems.length === 0 ? (
                  <div className="text-sm text-gray-500">
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
        "rounded-xl border border-gray-700/40 bg-black/40 hover:bg-black/60 hover:border-gray-600/50 transition-all duration-200",
        "px-4 py-3 text-left shadow-[0_8px_32px_rgba(0,0,0,0.4)] group"
      )}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white group-hover:text-white transition-colors">
            {title}
          </div>
          <div className="mt-1 text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
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
    <div className="h-[44px] w-[64px] overflow-hidden rounded-xl border border-gray-700/40 bg-black/40 backdrop-blur-sm">
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
            stroke="rgba(255,255,255,0.20)"
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
