"use client";

import React from "react";

export type PromptVersion = {
  id: string;
  createdAt: string;
  text: string;
  charCount: number;
  tokenEstimate: number;
};

type Props = {
  versions: PromptVersion[];
  onRestore: (id: string) => void;
};

export default function VersionHistoryPanel({ versions, onRestore }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 text-[11px] font-semibold text-white/70">
        Version history
      </div>
      <div className="flex-1 rounded-2xl border border-white/15 bg-black/60 overflow-y-auto text-[11px]">
        {versions.length === 0 ? (
          <div className="px-3 py-2 text-white/50">
            No versions yet. Use “Save version” to snapshot this prompt.
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {versions
              .slice()
              .reverse()
              .map((v) => (
                <li
                  key={v.id}
                  className="px-3 py-2 hover:bg-white/5 cursor-pointer"
                  onClick={() => onRestore(v.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] text-white/60">
                      {v.createdAt}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {v.charCount} chars · ~{v.tokenEstimate} tokens
                    </span>
                  </div>
                  <p className="line-clamp-2 text-white/75">{v.text}</p>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="mt-1 text-[10px] text-white/35">
        Placeholders and version history are stored locally for now.
      </div>
    </div>
  );
}
