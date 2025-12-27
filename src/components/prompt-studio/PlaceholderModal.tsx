"use client";

import React, { useState } from "react";

type Props = {
  alreadyUsedNames: string[];
  onClose: () => void;
  onConfirm: (name: string, question: string) => void;
};

export default function PlaceholderModal({
  alreadyUsedNames,
  onClose,
  onConfirm,
}: Props) {
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
      setError("That placeholder name is already used. It will be updated.");
    } else {
      setError(null);
    }

    onConfirm(cleaned, question.trim());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#050505] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Create placeholder</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white/90"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              Placeholder name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="example: product_name"
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400"
            />
            <p className="text-[11px] text-white/45">
              Only letters, numbers, dots, dashes and underscores. It will be
              used as{" "}
              <code className="text-emerald-300 font-mono">{"{{name}}"}</code>.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-white/70">
              Question to ask the user
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Example: What is the product name?"
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400 resize-none"
            />
          </div>

          {error && <p className="text-[11px] text-amber-300">{error}</p>}

          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-emerald-500 px-4 py-1 font-semibold text-black hover:brightness-[1.05]"
            >
              Insert placeholder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
