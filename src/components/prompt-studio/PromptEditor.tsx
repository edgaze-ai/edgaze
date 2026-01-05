// src/components/prompt-studio/PromptEditor.tsx
"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function PromptEditor({ value, onChange }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
        Prompt editor
      </div>
      <div className="flex-1 rounded-2xl border border-white/12 bg-black/60 overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-white outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
