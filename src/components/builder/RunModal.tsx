"use client";

import { useEffect, useState } from "react";
import { on } from "@lib/bus";

type Phase =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "finished"; data: any }
  | { phase: "error"; message: string };

export default function RunModal() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Phase>({ phase: "idle" });

  useEffect(() => {
    const off = on("workflow:status", (p: Phase) => {
      setState(p);
      setOpen(true);
    });
    return off;
  }, []);

  if (!open) return null;

  const body =
    state.phase === "starting"
      ? "Starting the workflow…"
      : state.phase === "finished"
      ? JSON.stringify(state.data, null, 2)
      : state.phase === "error"
      ? `Error: ${state.message}\n\nTip: Check blocks needing inputs, ensure required connections exist, or restart the API server.`
      : "";

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center"
      aria-modal="true"
      role="dialog"
    >
      {/* fully opaque scrim (no transparency) */}
      <div className="absolute inset-0 bg-black/80" />

      {/* modal */}
      <div className="relative w-[min(920px,92vw)] rounded-2xl border border-white/10 bg-[#121212] text-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-xl font-semibold">
            {state.phase === "error"
              ? "Run failed"
              : state.phase === "finished"
              ? "Run finished"
              : "Running…"}
          </h3>
          <button
            onClick={() => {
              setOpen(false);
              setState({ phase: "idle" });
            }}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/15"
          >
            Close
          </button>
        </div>

        <div className="p-5">
          <pre className="whitespace-pre-wrap text-sm leading-6 bg-black/35 rounded-xl p-4 border border-white/10 overflow-auto max-h-[60vh]">
            {body}
          </pre>
        </div>
      </div>
    </div>
  );
}
