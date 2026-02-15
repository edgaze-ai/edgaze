// src/components/prompt-studio/PlaceholderUserForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { PlaceholderDef } from "../../app/prompt-studio/page";

type Props = {
  placeholders: PlaceholderDef[];
};

type ValueMap = Record<string, string>;

export default function PlaceholderUserForm({ placeholders }: Props) {
  const [values, setValues] = useState<ValueMap>({});

  useEffect(() => {
    queueMicrotask(() => {
      setValues((prev) => {
        const next: ValueMap = { ...prev };
        for (const ph of placeholders) {
          if (next[ph.name] === undefined) next[ph.name] = "";
        }
        Object.keys(next).forEach((key) => {
          if (!placeholders.find((p) => p.name === key)) delete next[key];
        });
        return next;
      });
    });
  }, [placeholders]);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/50 px-3 py-3">
      {placeholders.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[11px] text-white/45">
          Add placeholders to see the customer form here.
        </div>
      ) : (
        <div className="space-y-2">
          {placeholders.map((ph) => (
            <div key={ph.name} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-white/85">
                  {ph.question || ph.name}
                </span>
                <span className="rounded-full border border-cyan-400/25 bg-gradient-to-r from-cyan-400/10 via-sky-500/10 to-pink-500/10 px-2 py-0.5 text-[10px] font-mono text-white/80">
                  {`{{${ph.name}}}`}
                </span>
              </div>
              <input
                value={values[ph.name] ?? ""}
                onChange={(e) => handleChange(ph.name, e.target.value)}
                placeholder="User answer (preview only)"
                className="w-full rounded-xl border border-white/12 bg-black/60 px-3 py-2 text-[11px] text-white outline-none focus:border-cyan-400"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
