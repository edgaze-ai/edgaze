// src/components/prompt-studio/PlaceholderModal.tsx
"use client";

import React, { useState } from "react";

type Props = {
  alreadyUsedNames: string[];
  onClose: () => void;
  onConfirm: (name: string, question: string) => void;
};

export default function PlaceholderModal({ alreadyUsedNames, onClose, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleaned = name
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_.-]/g, "")
      .toLowerCase();

    if (!cleaned) {
      setError("Placeholder name is required.");
      return;
    }
    if (!question.trim()) {
      setError("You must write the question that will be asked to the user.");
      return;
    }

    if (alreadyUsedNames.some((n) => n.toLowerCase() === cleaned)) {
      // allow overwrite; still insert/update
      setError("That placeholder name already exists. It will be updated.");
    } else {
      setError(null);
    }

    onConfirm(cleaned, question.trim());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#050505] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Insert placeholder</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-white/55 hover:text-white/90"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            Placeholders become fields customers fill before running your prompt.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="example: product_name"
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <p className="text-[11px] text-white/45">
              Only letters, numbers, dots, dashes, underscores. Used as{" "}
              <code className="font-mono text-cyan-200">{"{{name}}"}</code>.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Example: What is the product name?"
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
              Insert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
