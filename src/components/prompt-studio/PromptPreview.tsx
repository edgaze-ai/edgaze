"use client";

import React, { useMemo } from "react";
import { PlaceholderDef, VersionEntry } from "../../app/prompt-studio/page";

type Props = {
  rawText: string;
  filledText: string;
  placeholders: PlaceholderDef[];
  answers: Record<string, string>;
  onChangeAnswer: (name: string, value: string) => void;
  versions: VersionEntry[];
  onSelectVersion: (id: string) => void;
};

function highlightPlaceholders(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);

  return parts.map((part, idx) => {
    const match = part.match(/^\{\{([^}]+)\}\}$/);
    if (!match) {
      return (
        <span key={idx} className="text-white">
          {part}
        </span>
      );
    }

    const name = match[1].trim();
    return (
      <span
        key={idx}
        className="rounded bg-emerald-500/20 px-1 py-0.5 text-emerald-200 border border-emerald-400/60"
      >
        {`{{${name}}}`}
      </span>
    );
  });
}

export default function PromptPreview({
  rawText,
  filledText,
  placeholders,
  answers,
  onChangeAnswer,
  versions,
  onSelectVersion,
}: Props) {
  const hasPlaceholders = placeholders.length > 0;

  const versionsSorted = useMemo(
    () =>
      [...versions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [versions]
  );

  return (
    <div className="flex w-1/2 flex-col">
      {/* top labels */}
      <div className="flex border-b border-white/10 text-[11px] text-white/55">
        <div className="flex-1 px-4 py-2 border-r border-white/10">
          Preview with highlighted placeholders
        </div>
        <div className="w-[38%] px-4 py-2 border-r border-white/10">
          User answers (what they will see)
        </div>
        <div className="w-[24%] px-4 py-2">Version history</div>
      </div>

      <div className="flex flex-1 overflow-hidden text-xs">
        {/* preview */}
        <div className="flex-1 border-r border-white/10">
          <div className="h-full overflow-y-auto px-4 py-3">
            {rawText.trim() ? (
              <p className="whitespace-pre-wrap leading-relaxed">
                {highlightPlaceholders(rawText)}
              </p>
            ) : (
              <p className="text-white/35">
                Start typing on the left to see a preview with highlighted
                placeholders.
              </p>
            )}
          </div>
        </div>

        {/* user answers form */}
        <div className="w-[38%] border-r border-white/10">
          <div className="h-full overflow-y-auto px-4 py-3 space-y-3">
            {!hasPlaceholders && (
              <p className="text-white/40">
                When you add placeholders, this panel becomes the form users
                fill before running the prompt.
              </p>
            )}

            {placeholders.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-white/12 bg-white/5 px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/80">
                    {p.question}
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono">
                    {`{{${p.name}}}`}
                  </span>
                </div>
                <textarea
                  value={answers[p.name] ?? ""}
                  onChange={(e) => onChangeAnswer(p.name, e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-md bg-black/40 px-2 py-1 text-[11px] text-white outline-none border border-white/10 focus:border-emerald-400"
                  placeholder="User answer goes here…"
                />
              </div>
            ))}

            {hasPlaceholders && (
              <div className="rounded-md bg-white/5 px-2 py-2 text-[10px] text-white/55">
                <div className="font-semibold text-white/70 mb-1">
                  Filled preview
                </div>
                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {filledText}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* versions */}
        <div className="w-[24%]">
          <div className="h-full overflow-y-auto px-3 py-3 space-y-2">
            {versionsSorted.length === 0 && (
              <p className="text-white/40 text-[11px]">
                Save versions from the toolbar to track changes. Version history
                is stored locally for now.
              </p>
            )}

            {versionsSorted.map((v) => {
              const d = new Date(v.createdAt);
              const summary =
                v.text.length > 140 ? v.text.slice(0, 140) + "…" : v.text;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVersion(v.id)}
                  className="w-full rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-left hover:border-cyan-400/70 hover:bg-white/10"
                >
                  <div className="flex justify-between text-[10px] text-white/55 mb-1">
                    <span>
                      {d.toLocaleDateString()} {d.toLocaleTimeString()}
                    </span>
                    <span>{v.text.length} chars</span>
                  </div>
                  <div className="text-[11px] text-white/80 line-clamp-3">
                    {summary}
                  </div>
                </button>
              );
            })}

            {versionsSorted.length > 0 && (
              <p className="text-[10px] text-white/40 pt-1">
                Version history is stored locally for now.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
