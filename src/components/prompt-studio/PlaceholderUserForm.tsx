"use client";

import React, { useEffect, useState } from "react";
import type { PlaceholderDef } from "../../app/prompt-studio/page";

type Props = {
  placeholders: PlaceholderDef[];
};

type ValueMap = Record<string, string>;

export default function PlaceholderUserForm({ placeholders }: Props) {
  const [values, setValues] = useState<ValueMap>({});

  // ensure keys exist for new placeholders
  useEffect(() => {
    setValues((prev) => {
      const next: ValueMap = { ...prev };
      for (const ph of placeholders) {
        if (next[ph.name] === undefined) {
          next[ph.name] = "";
        }
      }
      // also prune removed placeholders
      Object.keys(next).forEach((key) => {
        if (!placeholders.find((p) => p.name === key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [placeholders]);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <section className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2">
      <div className="mb-1 text-[11px] font-semibold text-white/70">
        User form preview
      </div>
      <p className="mb-2 text-[11px] text-white/45">
        This is what your customer will fill in before running the prompt.
      </p>

      {placeholders.length === 0 ? (
        <div className="rounded-lg bg-black/70 px-3 py-2 text-[11px] text-white/40">
          Add placeholders in the editor to see the questions here.
        </div>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto rounded-lg bg-black/70 px-3 py-2">
          {placeholders.map((ph) => (
            <div key={ph.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-white/80">
                  {ph.question || ph.name}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  {`{{${ph.name}}}`}
                </span>
              </div>
              <input
                value={values[ph.name] ?? ""}
                onChange={(e) => handleChange(ph.name, e.target.value)}
                placeholder="User answer (preview only)"
                className="w-full rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[11px] text-white outline-none focus:border-emerald-400"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}