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
  graph?: any; // NEW (optional) – used for preview
};

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
      {/* Bigger modal, subtle rounding (per your latest ask) */}
      <div className="w-[min(1180px,94vw)] h-[min(720px,90vh)] rounded-[26px] border border-white/12 bg-black/55 shadow-[0_30px_140px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header (keep topbar) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Edgaze" className="h-8 w-8" />
            <div className="text-[18px] font-semibold text-white">Workflows</div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-4 py-2 text-[12px] text-white/85 hover:bg-white/10",
                  busy && "opacity-70 cursor-not-allowed"
                )}
                disabled={busy}
                title="Refresh"
              >
                <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} />
                Refresh
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 grid place-items-center"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-72px)] grid grid-cols-12 gap-6 p-6 overflow-hidden">
          {/* Left rail */}
          <div className="col-span-12 md:col-span-4 overflow-auto pr-1">
            <button
              onClick={onCreateNew}
              className="w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 px-5 py-4 text-left"
            >
              <div className="text-sm font-semibold text-white">New</div>
              <div className="text-xs text-white/55 mt-0.5">
                Start a new workflow
              </div>
            </button>

            {newForm}

            {errorText && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[12px] text-red-300 leading-relaxed">
                {errorText}
              </div>
            )}

            <div className="mt-4 text-[12px] text-white/45 leading-relaxed">
              Drafts autosave while you edit. Publishing pushes to the marketplace later.
            </div>
          </div>

          {/* Right content */}
          <div className="col-span-12 md:col-span-8 overflow-auto pr-1">
            {/* Continue */}
            <div>
              <div className="text-sm font-semibold text-white/90 mb-3">
                Continue
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {continueItems.length === 0 ? (
                  <div className="text-sm text-white/50">No drafts yet.</div>
                ) : (
                  continueItems.map((w) => (
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

            {/* Your workflows */}
            <div className="mt-7">
              <div className="text-sm font-semibold text-white/90 mb-3">
                Your workflows
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {publishedItems.length === 0 ? (
                  <div className="text-sm text-white/50">
                    No published workflows yet.
                  </div>
                ) : (
                  publishedItems.map((w) => (
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
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{title}</div>
          <div className="mt-1 text-xs text-white/55">{meta} · {summary}</div>
        </div>

        {/* Tiny graph preview */}
        <div className="shrink-0">
          <MiniGraphPreview graph={graph} />
        </div>
      </div>
    </button>
  );
}

function MiniGraphPreview({ graph }: { graph?: any }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  // deterministic tiny layout: place up to 6 nodes on a grid
  const pts = nodes.slice(0, 6).map((n: any, i: number) => {
    const x = 10 + (i % 3) * 16;
    const y = 10 + Math.floor(i / 3) * 16;
    return { id: n.id ?? String(i), x, y };
  });

  const byId = new Map(pts.map((p) => [p.id, p]));

  const lines = edges.slice(0, 6).flatMap((e: any) => {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) return [];
    return [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }];
  });

  return (
    <div className="h-[44px] w-[64px] rounded-xl border border-white/12 bg-black/35 overflow-hidden">
      <svg viewBox="0 0 64 44" className="h-full w-full">
        <defs>
          <linearGradient id="edg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(34,211,238,0.9)" />
            <stop offset="1" stopColor="rgba(232,121,249,0.9)" />
          </linearGradient>
        </defs>

        {lines.map((l, i) => (
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

        {pts.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="url(#edg)"
          />
        ))}

        {pts.length === 0 && (
          <rect x="10" y="14" width="44" height="16" rx="8" fill="rgba(255,255,255,0.06)" />
        )}
      </svg>
    </div>
  );
}
