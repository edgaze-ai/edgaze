// src/components/prompt-studio/PublishOutputDemosSection.tsx
"use client";

import React from "react";
import { PublishMeta } from "./types";

type Props = {
  meta: PublishMeta;
  onChange: (next: PublishMeta) => void;
  onOpenDemoPicker: (index: number) => void;
};

export default function PublishOutputDemosSection({
  meta,
  onChange,
  onOpenDemoPicker,
}: Props) {
  const demos = meta.outputDemoUrls ?? [];

  const removeDemo = (index: number) => {
    const next = demos.filter((_, i) => i !== index);
    onChange({ ...meta, outputDemoUrls: next });
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-medium text-white/70">
        Output demos (optional)
      </div>
      <p className="text-[10px] text-white/45">
        Show examples of the actual output your prompt / workflow generates.
        Up to 6 images.
      </p>

      <div className="flex flex-wrap gap-3">
        {demos.map((url, idx) => (
          <div
            key={idx}
            className="relative h-24 w-32 overflow-hidden rounded-xl border border-white/15 bg-white/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              onClick={() => onOpenDemoPicker(idx)}
            />
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80 hover:bg-black"
              onClick={() => removeDemo(idx)}
            >
              ×
            </button>
          </div>
        ))}

        {demos.length < 6 && (
          <button
            type="button"
            onClick={() => onOpenDemoPicker(demos.length)}
            className="flex h-24 w-32 items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 text-[11px] text-white/70 hover:border-cyan-400 hover:bg-white/10"
          >
            + Add image
          </button>
        )}
      </div>
    </div>
  );
}