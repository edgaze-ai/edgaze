"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { X, CheckCircle2, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { cx } from "../../lib/cx";
import { track } from "../../lib/mixpanel";

function safeTrack(event: string, props?: Record<string, any>) {
  try {
    track(event, props);
  } catch {}
}

export type RunStepStatus = "queued" | "running" | "done" | "error" | "skipped";

export type WorkflowRunStep = {
  id: string;
  title: string; // simple human words
  detail?: string;
  status: RunStepStatus;
};

export type WorkflowRunLogLine = {
  t: number; // ms epoch
  level: "info" | "warn" | "error";
  text: string;
};

export type WorkflowRunState = {
  workflowId: string;
  workflowName: string;
  status: "idle" | "running" | "success" | "error";
  startedAt?: number;
  finishedAt?: number;
  steps: WorkflowRunStep[];
  currentStepId?: string | null;
  logs: WorkflowRunLogLine[];
  summary?: string;
};

export default function WorkflowRunModal({
  open,
  onClose,
  state,
  onCancel,
  onRerun,
}: {
  open: boolean;
  onClose: () => void;
  state: WorkflowRunState | null;
  onCancel?: () => void;
  onRerun?: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const canClose = useMemo(() => {
    if (!state) return true;
    return state.status !== "running";
  }, [state]);

  useEffect(() => {
    if (!open) return;
    
    safeTrack("Workflow Run Modal Opened", {
      surface: "builder",
      workflow_id: state?.workflowId,
      workflow_name: state?.workflowName,
      status: state?.status,
      step_count: state?.steps?.length || 0,
    });
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (canClose) {
          safeTrack("Workflow Run Modal Closed", {
            surface: "builder",
            workflow_id: state?.workflowId,
            method: "escape_key",
            final_status: state?.status,
          });
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, canClose, state?.workflowId, state?.workflowName, state?.status, state?.steps?.length]);

  useEffect(() => {
    if (!open) return;
    // auto-scroll logs to bottom while running
    if (state?.status === "running") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [open, state?.logs?.length, state?.status]);

  if (!open) return null;

  const statusPill =
    state?.status === "running"
      ? { label: "Running", icon: <Loader2 className="h-4 w-4 animate-spin" /> }
      : state?.status === "success"
      ? { label: "Completed", icon: <CheckCircle2 className="h-4 w-4" /> }
      : state?.status === "error"
      ? { label: "Failed", icon: <AlertTriangle className="h-4 w-4" /> }
      : { label: "Ready", icon: <Sparkles className="h-4 w-4" /> };

  return (
    <div className="fixed inset-0 z-[120]">
      {/* backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onMouseDown={(e) => {
          if (e.target !== overlayRef.current) return;
          if (!canClose) return;
          onClose();
        }}
      />

      {/* animated gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[40%] opacity-70 animate-[spin_20s_linear_infinite] [background:conic-gradient(from_90deg,rgba(34,211,238,0.22),rgba(217,70,239,0.18),rgba(34,211,238,0.22))]" />
        <div className="absolute -inset-[35%] opacity-50 animate-[spin_34s_linear_infinite] [background:conic-gradient(from_210deg,rgba(255,255,255,0.06),rgba(34,211,238,0.16),rgba(217,70,239,0.14),rgba(255,255,255,0.06))]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_50%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[min(980px,96vw)] h-[min(740px,92vh)] rounded-3xl border border-white/12 bg-black/45 backdrop-blur-2xl shadow-[0_30px_140px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-white/55">Run</div>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <div className="text-lg font-semibold text-white truncate">
                  {state?.workflowName || "Workflow"}
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                  {statusPill.icon}
                  {statusPill.label}
                </span>
              </div>
              {state?.summary ? (
                <div className="mt-1 text-sm text-white/65">{state.summary}</div>
              ) : (
                <div className="mt-1 text-sm text-white/60">
                  Executing your workflow with human-readable updates.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {state?.status === "running" && (
                <button
                  onClick={() => {
                    safeTrack("Workflow Run Cancelled", {
                      surface: "builder",
                      workflow_id: state?.workflowId,
                      workflow_name: state?.workflowName,
                      step_count: state?.steps?.length || 0,
                      current_step: state?.currentStepId,
                    });
                    onCancel?.();
                  }}
                  className="rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition-colors"
                >
                  Cancel
                </button>
              )}

              {(state?.status === "success" || state?.status === "error") && (
                <button
                  onClick={() => {
                    safeTrack("Workflow Run Again Clicked", {
                      surface: "builder",
                      workflow_id: state?.workflowId,
                      workflow_name: state?.workflowName,
                      previous_status: state?.status,
                    });
                    onRerun?.();
                  }}
                  className="rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition-colors"
                >
                  Run again
                </button>
              )}

              <button
                onClick={() => {
                  if (!canClose) return;
                  safeTrack("Workflow Run Modal Closed", {
                    surface: "builder",
                    workflow_id: state?.workflowId,
                    method: "close_button",
                    final_status: state?.status,
                    duration_ms: state?.startedAt && state?.finishedAt ? state.finishedAt - state.startedAt : undefined,
                  });
                  onClose();
                }}
                className={cx(
                  "h-10 w-10 rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 grid place-items-center transition-colors",
                  !canClose && "opacity-50 cursor-not-allowed"
                )}
                title={canClose ? "Close" : "Running…"}
              >
                <X className="h-5 w-5 text-white/85" />
              </button>
            </div>
          </div>

          {/* body */}
          <div className="grid grid-cols-12 gap-0 h-[calc(100%-72px)]">
            {/* steps */}
            <div className="col-span-5 border-r border-white/10 p-4 overflow-auto">
              <div className="text-xs uppercase tracking-widest text-white/45">What’s happening</div>
              <div className="mt-3 space-y-2">
                {(state?.steps || []).map((s) => {
                  const isActive = state?.currentStepId === s.id && state?.status === "running";
                  const badge =
                    s.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white/80" />
                    ) : s.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-white/80" />
                    ) : s.status === "error" ? (
                      <AlertTriangle className="h-4 w-4 text-white/80" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-white/15 bg-white/5" />
                    );

                  return (
                    <div
                      key={s.id}
                      className={cx(
                        "rounded-2xl border border-white/12 bg-white/[0.035] px-4 py-3 transition-all",
                        isActive && "bg-white/[0.06] border-white/20 shadow-[0_16px_60px_rgba(0,0,0,0.35)]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{badge}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white/90">{s.title}</div>
                          {s.detail ? <div className="mt-1 text-xs text-white/60">{s.detail}</div> : null}
                        </div>
                        <div className="ml-auto">
                          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/60">
                            {s.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!state?.steps || state.steps.length === 0) && (
                  <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-sm text-white/65">
                    No steps yet.
                  </div>
                )}
              </div>
            </div>

            {/* logs */}
            <div className="col-span-7 p-4 overflow-auto">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-white/45">Logs</div>
                <div className="text-[11px] text-white/45">
                  {state?.logs?.length || 0} events
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/12 bg-black/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 text-xs text-white/55">
                  Simple internal events (not raw code logs).
                </div>
                <div className="p-3 space-y-2 font-mono text-[12px] leading-relaxed">
                  {(state?.logs || []).map((l, idx) => (
                    <div key={idx} className="flex gap-3">
                      <span className="text-white/35">
                        {new Date(l.t).toLocaleTimeString()}
                      </span>
                      <span
                        className={cx(
                          "uppercase text-[10px] tracking-widest",
                          l.level === "info" && "text-white/50",
                          l.level === "warn" && "text-white/70",
                          l.level === "error" && "text-white/80"
                        )}
                      >
                        {l.level}
                      </span>
                      <span className="text-white/80">{l.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                  {(state?.logs || []).length === 0 && (
                    <div className="text-white/55">Waiting…</div>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-white/45">
                Foundation: this UI is fed by a future “workflow runtime” that streams step events in real time.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
