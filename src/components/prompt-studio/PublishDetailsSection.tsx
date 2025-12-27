// src/components/prompt-studio/PublishDetailsSection.tsx
"use client";

import React from "react";

import { PublishMeta } from "./types";

type Props = {
  meta: PublishMeta;
  onChange: (next: PublishMeta) => void;
  onOpenThumbnailPicker: () => void;
};

export default function PublishDetailsSection({
  meta,
  onChange,
  onOpenThumbnailPicker,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-white/70">
          Prompt name
        </label>
        <input
          value={meta.name}
          onChange={(e) => onChange({ ...meta, name: e.target.value })}
          placeholder="Example: YouTube title generator"
          className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-white/70">
          Short description
        </label>
        <textarea
          value={meta.description}
          onChange={(e) =>
            onChange({ ...meta, description: e.target.value })
          }
          rows={3}
          placeholder="Explain what this prompt does and who it is for."
          className="w-full resize-none rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-white/70">
            Thumbnail
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenThumbnailPicker}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-3 py-2 text-xs text-white/80 hover:border-cyan-400 hover:bg-white/10"
            >
              Upload / pick
            </button>
            {meta.thumbnailUrl && (
              <span className="truncate text-[11px] text-white/50">
                {meta.thumbnailUrl}
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/40">
            If empty, Edgaze will generate a blurred prompt thumbnail for you.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-white/70">
            SEO tags / keywords
          </label>
          <input
            value={meta.tags}
            onChange={(e) => onChange({ ...meta, tags: e.target.value })}
            placeholder="youtube, hooks, titles, ai"
            className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
          <p className="text-[10px] text-white/40">
            Comma-separated. Used for search and discovery.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-white/70">
          Visibility
        </span>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(["public", "unlisted", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ...meta, visibility: v })}
              className={`rounded-2xl px-3 py-1.5 ${
                meta.visibility === v
                  ? "bg-cyan-500 text-black"
                  : "border border-white/20 bg-black/40 text-white/75 hover:border-cyan-400"
              }`}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}