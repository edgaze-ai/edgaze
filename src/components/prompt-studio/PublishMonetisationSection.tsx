// src/components/prompt-studio/PublishMonetisationSection.tsx
"use client";

import React from "react";
import { PublishMeta } from "./types";

type Props = {
  meta: PublishMeta;
  onChange: (next: PublishMeta) => void;
};

export default function PublishMonetisationSection({ meta, onChange }: Props) {
  const isPaid =
    meta.monetisationMode === "paywall" ||
    meta.monetisationMode === "subscription" ||
    meta.monetisationMode === "paywall+subscription";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-white/70">
          Access & pricing
        </span>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              onChange({ ...meta, monetisationMode: "free", priceUsd: "" })
            }
            className={`rounded-2xl border px-3 py-2 text-left text-[12px] ${
              meta.monetisationMode === "free"
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-white/20 bg-black/40 hover:border-cyan-400"
            }`}
          >
            <div className="font-semibold">Free</div>
            <div className="text-[11px] text-white/55">
              Anyone can run this prompt without paying.
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onChange({ ...meta, monetisationMode: "paywall" })
            }
            className={`rounded-2xl border px-3 py-2 text-left text-[12px] ${
              meta.monetisationMode === "paywall"
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-white/20 bg-black/40 hover:border-cyan-400"
            }`}
          >
            <div className="font-semibold">One-time paywall</div>
            <div className="text-[11px] text-white/55">
              Charge a one-time price to unlock this prompt.
            </div>
          </button>
        </div>
      </div>

      {isPaid && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-white/70">
            Price (USD)
          </label>
          <input
            value={meta.priceUsd ?? ""}
            onChange={(e) => onChange({ ...meta, priceUsd: e.target.value })}
            placeholder="19"
            className="w-32 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-white/70">
          Custom Edgaze code (optional)
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[11px] text-white/50">edgaze.ai/@handle/</span>
          <input
            value={meta.edgazeCode ?? ""}
            onChange={(e) => onChange({ ...meta, edgazeCode: e.target.value })}
            placeholder="title-wizard"
            className="flex-1 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}