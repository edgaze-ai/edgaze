"use client";

import { useEffect, useState, useMemo } from "react";
import { on } from "@lib/bus";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Phase =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "finished"; data: any }
  | { phase: "error"; message: string };

type Tab = "output" | "logs" | "raw";

export default function RunModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ phase: "idle" });
  const [tab, setTab] = useState<Tab>("output");

  /* -----------------------------------------------
   * Listen to workflow run events
   * --------------------------------------------- */
  useEffect(() => {
    const off = on("workflow:status", (p: Phase) => {
      setPhase(p);
      setOpen(true);
      setTab("output"); // reset tab every run
    });
  
    return () => {
      try {
        // ensure cleanup returns void even if off() returns boolean
        (off as unknown as (() => void))?.();
      } catch {
        // no-op
      }
    };
  }, []);
  
  /* -----------------------------------------------
   * Data Extraction (safe) – hooks must ALWAYS run
   * --------------------------------------------- */

  const safeOutput = useMemo(() => {
    if (phase.phase !== "finished") return null;
    const d = phase.data;
    return typeof d === "object" ? d?.output ?? d : d;
  }, [phase]);

  const safeLogs = useMemo(() => {
    if (phase.phase !== "finished") return [];
    const d = phase.data;
    return Array.isArray(d?.logs) ? d.logs : [];
  }, [phase]);

  const prettyJSON = useMemo(() => {
    if (phase.phase !== "finished") return "";
    try {
      return JSON.stringify(phase.data, null, 2);
    } catch {
      return String(phase.data);
    }
  }, [phase]);

  /* -----------------------------------------------
   * TopBar Icon
   * --------------------------------------------- */
  const StatusIcon = () => {
    if (phase.phase === "starting") {
      return <Loader2 size={18} className="animate-spin text-white/80" />;
    }
    if (phase.phase === "finished") {
      return <CheckCircle2 size={18} className="text-emerald-400" />;
    }
    if (phase.phase === "error") {
      return <AlertTriangle size={18} className="text-red-400" />;
    }
    return null;
  };

  /* -----------------------------------------------
   * Content Renderer
   * --------------------------------------------- */
  const renderBody = () => {
    if (phase.phase === "starting") {
      return (
        <div className="p-6 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-white/70" />
            <span>Starting workflow…</span>
          </div>
        </div>
      );
    }

    if (phase.phase === "error") {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300">
            {phase.message || "Unknown error occurred."}
            <div className="mt-3 text-xs text-white/60">
              • Ensure required connections exist
              <br />
              • Check nodes that need inputs
              <br />
              • Restart your server if necessary
            </div>
          </div>
        </div>
      );
    }

    if (phase.phase === "finished") {
      return (
        <div className="px-4 pt-3 pb-4 text-[11px] text-white/85">
          {/* Output */}
          {tab === "output" && (
            <div className="max-h-[60vh] space-y-3 overflow-auto pr-2">
              {safeOutput ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-4 text-[11px] leading-5">
                  {JSON.stringify(safeOutput, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-white/60">
                  No output returned from workflow.
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {tab === "logs" && (
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-2">
              {safeLogs.length === 0 && (
                <div className="text-sm text-white/60">
                  No logs recorded for this execution.
                </div>
              )}
              {safeLogs.map((l: any, i: number) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <div className="text-[11px] text-white/70">{l?.time}</div>
                  <div className="text-[11px] leading-5">{l?.message}</div>
                </div>
              ))}
            </div>
          )}

          {/* Raw JSON */}
          {tab === "raw" && (
            <div className="max-h-[60vh] overflow-auto pr-2">
              <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-4 text-[11px] leading-5">
                {prettyJSON}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  /* -----------------------------------------------
   * Guard AFTER hooks – safe for React
   * --------------------------------------------- */
  if (!open) return null;

  /* -----------------------------------------------
   * Component Render
   * --------------------------------------------- */

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-xl"
      aria-modal="true"
      role="dialog"
    >
      {/* Modal container */}
      <div className="relative w-[min(900px,92vw)] overflow-hidden rounded-2xl border border-white/10 bg-[#0e0f12]/95 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-[13px]">
          <div className="flex items-center gap-2">
            <StatusIcon />
            <span className="font-semibold">
              {phase.phase === "starting" && "Running Workflow…"}
              {phase.phase === "finished" && "Run Complete"}
              {phase.phase === "error" && "Run Failed"}
            </span>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              setPhase({ phase: "idle" });
            }}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        {phase.phase === "finished" && (
          <div className="flex items-center gap-1 border-b border-white/5 px-4 pt-3 pb-1 text-[11px]">
            {(["output", "logs", "raw"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 transition ${
                  tab === t
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {t === "output" && "Output"}
                {t === "logs" && "Logs"}
                {t === "raw" && "Raw JSON"}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        {renderBody()}
      </div>
    </div>
  );
}
