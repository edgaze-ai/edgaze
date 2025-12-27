"use client";

import React from "react";
import type { PlaceholderDef } from "./PlaceholderUserForm";

type Props = {
  placeholders: PlaceholderDef[];
};

export default function PlaceholderBadgeBar({ placeholders }: Props) {
  if (placeholders.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-[72px] right-0 z-20 border-t border-white/15 bg-[#050505]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 overflow-x-auto text-[11px]">
        {placeholders.map((ph) => (
          <div
            key={ph.name}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-0.5 text-emerald-200"
          >
            <code className="font-mono text-[10px]">
              {"{{" + ph.name + "}}"}
            </code>
            <span className="text-white/75 truncate max-w-[200px]">
              {ph.question}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
