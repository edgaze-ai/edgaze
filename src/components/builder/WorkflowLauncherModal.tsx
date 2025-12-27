"use client";

import React from "react";
import { cx } from "@lib/cx";

type WorkflowRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at?: string;
  last_opened_at?: string;
};

export default function WorkflowLauncherModal({
  open,
  logoSrc = "/brand/edgaze-mark.png",
  continueItems,
  publishedItems,
  onCreateNew,
  onOpen,
  onClose,
}: {
  open: boolean;
  logoSrc?: string;
  continueItems: WorkflowRow[];
  publishedItems: WorkflowRow[];
  onCreateNew: () => void;
  onOpen: (id: string) => void;
  onClose?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[min(920px,92vw)] rounded-3xl border border-white/12 bg-black/55 shadow-[0_30px_120px_rgba(0,0,0,0.75)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Edgaze" className="h-8 w-8" />
            <div className="text-[18px] font-semibold text-white">Workflows</div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6 p-6">
          {/* Left rail */}
          <div className="col-span-12 md:col-span-4">
            <button
              onClick={onCreateNew}
              className="w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-3 text-left"
            >
              <div className="text-sm font-semibold text-white">New</div>
              <div className="text-xs text-white/55 mt-0.5">
                Start a new workflow
              </div>
            </button>

            <button
              onClick={() => {
                // later: open picker / import
              }}
              className="mt-3 w-full rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-3 text-left"
            >
              <div className="text-sm font-semibold text-white">Open</div>
              <div className="text-xs text-white/55 mt-0.5">
                Choose an existing workflow
              </div>
            </button>
          </div>

          {/* Right content */}
          <div className="col-span-12 md:col-span-8">
            {/* Continue */}
            <div>
              <div className="text-sm font-semibold text-white/90 mb-3">
                Continue
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {continueItems.length === 0 ? (
                  <div className="text-sm text-white/50">
                    No drafts yet.
                  </div>
                ) : (
                  continueItems.map((w) => (
                    <Card key={w.id} title={w.title} meta="Draft" onClick={() => onOpen(w.id)} />
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
  onClick,
}: {
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl border border-white/12 bg-black/35 hover:bg-black/25",
        "px-4 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="text-sm font-semibold text-white truncate">{title}</div>
      <div className="mt-1 text-xs text-white/55">{meta}</div>
    </button>
  );
}
