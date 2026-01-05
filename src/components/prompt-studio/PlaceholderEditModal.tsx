// src/components/prompt-studio/PlaceholderEditModal.tsx
"use client";

import React, { useMemo, useState } from "react";
import type { PlaceholderDef } from "../../app/prompt-studio/page";

type Props = {
  current: PlaceholderDef;
  alreadyUsedNames: string[];
  onClose: () => void;
  onSave: (nextName: string, nextQuestion: string) => void;
};

function cleanName(input: string) {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .toLowerCase();
}

export default function PlaceholderEditModal({
  current,
  alreadyUsedNames,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(current.name);
  const [question, setQuestion] = useState(current.question || "");
  const [error, setError] = useState<string | null>(null);

  const usedLower = useMemo(
    () => new Set(alreadyUsedNames.map((x) => x.toLowerCase())),
    [alreadyUsedNames]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleaned = cleanName(name);
    if (!cleaned) {
      setError("Placeholder name is required.");
      return;
    }
    if (!question.trim()) {
      setError("Question is required.");
      return;
    }

    // Allow rename into an existing placeholder (we merge), but warn.
    if (cleaned !== current.name && usedLower.has(cleaned)) {
      setError("That name already exists. This will merge into the existing placeholder.");
    } else {
      setError(null);
    }

    onSave(cleaned, question.trim());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#050505] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Edit placeholder</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-white/55 hover:text-white/90"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            Updates the placeholder definition. Renaming also updates tokens in the editor.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>

          {error && <p className="text-[11px] text-amber-300">{error}</p>}

          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-white/80 hover:bg-white/[0.07]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-4 py-2 font-semibold text-black hover:brightness-[1.05]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
