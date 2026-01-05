// src/components/prompt-studio/PromptPreview.tsx
"use client";

import React, { useMemo } from "react";
import type { PlaceholderDef, VersionSnapshot } from "../../app/prompt-studio/page";

type Props = {
  rawText: string;
  filledText: string;
  placeholders: PlaceholderDef[];
  answers: Record<string, string>;
  onChangeAnswer: (name: string, value: string) => void;
  versions: VersionSnapshot[];
  onSelectVersion: (id: string) => void;
};

function highlightPlaceholders(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);

  return parts.map((part, idx) => {
    const match = part.match(/^\{\{([^}]+)\}\}$/);
    if (!match) return <span key={idx}>{part}</span>;

    const name = match[1].trim();
    return (
      <span
        key={idx}
        className="rounded-lg border border-cyan-400/35 bg-gradient-to-r from-cyan-400/10 via-sky-500/10 to-pink-500/10 px-1.5 py-0.5 text-white/90"
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
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [versions]
  );

  return (
    <div className="flex w-1/2 flex-col">
      <div className="flex border-b border-white/10 text-[11px] text-white/55">
        <div className="flex-1 px-4 py-2 border-r border-white/10">
          Preview
        </div>
        <div className="w-[38%] px-4 py-2 border-r border-white/10">
          User answers
        </div>
        <div className="w-[24%] px-4 py-2">Versions</div>
      </div>

      <div className="flex flex-1 overflow-hidden text-xs">
        <div className="flex-1 border-r border-white/10">
          <div className="h-full overflow-y-auto px-4 py-3">
            {rawText.trim() ? (
              <p className="whitespace-pre-wrap leading-relaxed">{highlightPlaceholders(rawText)}</p>
            ) : (
              <p className="text-white/35">Start typing to see a preview.</p>
            )}
          </div>
        </div>

        <div className="w-[38%] border-r border-white/10">
          <div className="h-full overflow-y-auto px-4 py-3 space-y-3">
            {!hasPlaceholders && (
              <p className="text-white/40">
                Add placeholders to generate the customer form.
              </p>
            )}

            {placeholders.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/80">
                    {p.question}
                  </span>
                  <span className="text-[10px] text-cyan-200 font-mono">
                    {`{{${p.name}}}`}
                  </span>
                </div>
                <textarea
                  value={answers[p.name] ?? ""}
                  onChange={(e) => onChangeAnswer(p.name, e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl bg-black/40 px-2 py-1 text-[11px] text-white outline-none border border-white/10 focus:border-cyan-400"
                  placeholder="User answer…"
                />
              </div>
            ))}

            {hasPlaceholders && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/55">
                <div className="font-semibold text-white/70 mb-1">Filled preview</div>
                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">{filledText}</div>
              </div>
            )}
          </div>
        </div>

        <div className="w-[24%]">
          <div className="h-full overflow-y-auto px-3 py-3 space-y-2">
            {versionsSorted.length === 0 && (
              <p className="text-white/40 text-[11px]">
                Save versions to track changes (local only).
              </p>
            )}

            {versionsSorted.map((v) => {
              const d = new Date(v.createdAt);
              const summary = v.text.length > 140 ? v.text.slice(0, 140) + "…" : v.text;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVersion(v.id)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left hover:border-cyan-400/60 hover:bg-white/[0.06]"
                >
                  <div className="flex justify-between text-[10px] text-white/55 mb-1">
                    <span>
                      {d.toLocaleDateString()} {d.toLocaleTimeString()}
                    </span>
                    <span>{v.charCount}c</span>
                  </div>
                  <div className="text-[11px] text-white/80 line-clamp-3">{summary}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
