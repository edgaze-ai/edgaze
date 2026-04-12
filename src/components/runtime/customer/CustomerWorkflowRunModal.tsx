"use client";

import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Clock3, Loader2, StopCircle, X } from "lucide-react";

import { cx } from "../../../lib/cx";
import {
  deriveCustomerRuntimeModel,
  formatRunElapsed,
} from "../../../lib/workflow/customer-runtime";
import type { WorkflowRunState } from "../../../lib/workflow/run-types";
import CustomerWorkflowRuntimeSurface from "./CustomerWorkflowRuntimeSurface";

function useDocumentBody(): HTMLElement | null {
  return useSyncExternalStore(
    () => () => {},
    () => (typeof document !== "undefined" ? document.body : null),
    () => null,
  );
}

type BuilderRunLimit = {
  used: number;
  limit: number;
  isAdmin?: boolean;
};

type CustomerWorkflowRunModalProps = {
  open: boolean;
  state: WorkflowRunState | null;
  onClose: () => void;
  onCancel?: () => void;
  onRerun?: () => void;
  onSubmitInputs?: (values: Record<string, any>) => void;
  /** When true (e.g. signed-in admin), show elapsed timer in the execution chrome. */
  showExecutionTimer?: boolean;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
  onBuyWorkflow?: () => void;
};

export default function CustomerWorkflowRunModal({
  open,
  state,
  onClose,
  onCancel,
  onRerun,
  onSubmitInputs,
  showExecutionTimer,
  isBuilderTest,
  builderRunLimit,
  requiresApiKeys,
  onBuyWorkflow,
}: CustomerWorkflowRunModalProps) {
  const portalEl = useDocumentBody();

  if (!open) return null;
  if (!portalEl) return null;

  const canClose = state?.status !== "running" && state?.status !== "cancelling";
  const runtimeModel = state ? deriveCustomerRuntimeModel(state) : null;
  const isLiveExecution =
    Boolean(state) &&
    state!.phase === "executing" &&
    (state!.status === "running" || state!.status === "cancelling");
  const showHeaderCancel = Boolean(onCancel && runtimeModel?.canCancel && isLiveExecution);

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div
        className={cx(
          "absolute inset-0 transition-opacity duration-300",
          "bg-[radial-gradient(circle_at_top,rgba(98,190,255,0.10),transparent_34%),rgba(3,3,6,0.92)] backdrop-blur-xl",
          "max-md:bg-black/18 max-md:backdrop-blur-md",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => {
          if (canClose) onClose();
        }}
      />

      <div
        className={cx(
          "absolute inset-0",
          isLiveExecution ? "max-md:overflow-hidden md:overflow-y-auto" : "overflow-y-auto",
        )}
      >
        <div
          className={cx(
            "mx-auto flex w-full justify-center",
            isLiveExecution
              ? "max-w-[min(1024px,calc(100vw-1.5rem))] h-[100dvh] max-md:h-[100dvh] md:min-h-full"
              : "max-w-[min(560px,calc(100vw-1.5rem))] min-h-full",
            "items-end p-0 md:items-center md:p-5",
          )}
        >
          <div className="w-full max-md:max-w-none md:mx-auto">
            <div
              className={cx(
                "flex flex-col rounded-[34px] border border-white/10 bg-[#090a0e]/90 shadow-[0_40px_180px_rgba(0,0,0,0.72)] transition-all duration-500",
                "md:p-5",
                isLiveExecution
                  ? "max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:overflow-hidden p-0"
                  : "p-4",
                "max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0 max-md:border-t max-md:border-white/12",
                "max-md:shadow-[0_-32px_120px_rgba(0,0,0,0.45)]",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-white">
                    {state?.workflowName ?? "Workflow"}
                  </div>
                  {showExecutionTimer &&
                    state &&
                    (state.status === "running" || state.status === "cancelling") && (
                      <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                        <Clock3 className="h-3 w-3" />
                        {runtimeModel?.elapsedLabel ??
                          formatRunElapsed(state.startedAt, state.finishedAt)}
                      </div>
                    )}
                </div>
                {showHeaderCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-white/88"
                  >
                    {state?.status === "cancelling" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StopCircle className="h-4 w-4" />
                    )}
                    {state?.status === "cancelling" ? "Stopping…" : "Cancel"}
                  </button>
                )}
                {canClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div
                className={cx(
                  "min-h-0 flex-1",
                  isLiveExecution
                    ? "overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:overflow-auto md:p-4"
                    : "overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:p-5",
                )}
              >
                <CustomerWorkflowRuntimeSurface
                  state={state}
                  onCancel={onCancel}
                  onClose={canClose ? onClose : undefined}
                  onRerun={onRerun}
                  onSubmitInputs={onSubmitInputs}
                  showExecutionTimer={showExecutionTimer}
                  isBuilderTest={isBuilderTest}
                  builderRunLimit={builderRunLimit}
                  requiresApiKeys={requiresApiKeys}
                  onBuyWorkflow={onBuyWorkflow}
                  hideHeader
                  showInlineExecutionCancel={false}
                  renderExecutionChrome={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalEl,
  );
}
