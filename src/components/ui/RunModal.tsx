"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

type Log = {
  type: "start" | "success" | "error";
  nodeId: string;
  specId: string;
  message: string;
  timestamp: number;
};
type NodeStatus = "idle" | "running" | "success" | "error";

export default function RunModal({
  open,
  onClose,
  running,
  logs,
  nodeStatus,
  summary,
  errorText,
}: {
  open: boolean;
  onClose: () => void;
  running: boolean;
  logs: Log[];
  nodeStatus: Record<string, NodeStatus>;
  summary?: string | null;
  errorText?: string | null;
}) {
  const anyError = useMemo(() => logs.some((l) => l.type === "error"), [logs]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* dim backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Outer gradient border (Edgaze) */}
      <div className="relative w-[920px] max-w-[94vw] rounded-2xl p-[2px] edge-grad shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Card */}
        <div className="rounded-2xl bg-[#0f1012]/95 backdrop-blur-sm border border-white/12 p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: "linear-gradient(90deg, #22d3ee, #e879f9)" }}
              />
              <h3 className="text-xl font-semibold tracking-tight">Workflow status</h3>
            </div>
            <button
              aria-label="Close"
              className="rounded-full px-2.5 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 transition"
              onClick={onClose}
              title="Close"
            >
              <X size={16} className="opacity-80" />
            </button>
          </div>

          {/* Summary */}
          <section className="mb-6">
            <div className="flex items-center gap-2 text-[12px] text-white/60 mb-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300/70" />
              <span>Summary</span>
            </div>
            <p className="text-[14px] leading-7 text-white/85">
              {running && !summary && !errorText && "Running your workflow… this will just take a moment."}
              {!running && summary && summary}
              {!running && !summary && errorText && (
                <span className="text-white/80">{errorText}</span>
              )}
            </p>
          </section>

          {/* Blocks */}
          <section className="mb-6">
            <div className="flex items-center gap-2 text-[12px] text-white/60 mb-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-pink-300/70" />
              <span>Blocks</span>
            </div>

            {Object.keys(nodeStatus).length === 0 ? (
              <div className="text-[14px] text-white/65">No blocks ran yet.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(nodeStatus).map(([id, s]) => (
                  <StatusChip key={id} id={id} status={s} />
                ))}
              </div>
            )}
          </section>

          {/* Log */}
          <section>
            <div className="flex items-center gap-2 text-[12px] text-white/60 mb-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
              <span>What happened</span>
            </div>

            <div className="h-[300px] overflow-auto rounded-xl border border-white/10 bg-[#0b0c0e] p-4">
              {logs.length === 0 && (
                <div className="text-[14px] text-white/60">No messages yet…</div>
              )}
              {logs.map((l, i) => (
                <LogRow key={i} log={l} />
              ))}
            </div>
          </section>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between">
            <div className={"text-xs " + (anyError ? "text-rose-300" : "text-white/60")}>
              {running ? "Running…" : anyError ? "Completed with some issues." : "All good!"}
            </div>
            <div className="inline-flex rounded-full p-[1.5px] bg-white/5 border border-white/10">
              <button
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-sm font-medium bg-[#121316] hover:bg-[#1a1b20] transition"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,.08), 0 0 0 1px rgba(34,211,238,.18), 0 0 0 2px rgba(232,121,249,.12)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function StatusChip({ id, status }: { id: string; status: NodeStatus }) {
  const label =
    status === "running" ? "Running…" : status === "success" ? "Done" : status === "error" ? "Error" : "Waiting";

  const outline =
    status === "success"
      ? "0 0 0 1px rgba(34,197,94,.35)"
      : status === "error"
      ? "0 0 0 1px rgba(244,63,94,.35)"
      : status === "running"
      ? "0 0 0 1px rgba(34,211,238,.35)"
      : "0 0 0 1px rgba(255,255,255,.12)";

  const dot =
    status === "success"
      ? "#34d399"
      : status === "error"
      ? "#fb7185"
      : status === "running"
      ? "#22d3ee"
      : "rgba(255,255,255,.45)";

  return (
    <div
      className="flex items-center justify-between rounded-xl px-3 py-2 bg-[#101216] border border-white/10"
      style={{ boxShadow: outline }}
    >
      <span className="text-[13px] opacity-85 truncate">{id}</span>
      <span className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        <span className="opacity-90">{label}</span>
      </span>
    </div>
  );
}

function LogRow({ log }: { log: Log }) {
  const color =
    log.type === "success" ? "#34d399" : log.type === "error" ? "#fb7185" : "#22d3ee";
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="inline-block mt-1 h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <div className="flex-1 text-[14px] leading-7">
        <span className="opacity-55">{new Date(log.timestamp).toLocaleTimeString()} — </span>
        <span className="font-medium">{log.specId}</span>
        <span className="opacity-55"> ({log.nodeId})</span>
        <span className="opacity-85">: {pretty(log)}</span>
      </div>
    </div>
  );
}

function pretty(l: Log): string {
  if (l.type === "start") return "starting";
  if (l.type === "success") return "finished successfully";
  if (l.type === "error") {
    const msg = l.message.replace(/^Failed "[^"]+":\s*/i, "");
    return `error — ${msg || "Something went wrong"}`;
  }
  return l.message;
}
