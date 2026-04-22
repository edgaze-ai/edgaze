"use client";

import React, { type ReactNode, useSyncExternalStore } from "react";
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
  demoImageWatermarkEnabled?: boolean;
  demoImageWatermarkOwnerHandle?: string | null;
  customBody?: ReactNode;
  canCloseOverride?: boolean;
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
  demoImageWatermarkEnabled,
  demoImageWatermarkOwnerHandle,
  customBody,
  canCloseOverride,
}: CustomerWorkflowRunModalProps) {
  const portalEl = useDocumentBody();

  if (!open) return null;
  if (!portalEl) return null;

  const canClose =
    canCloseOverride ?? (state?.status !== "running" && state?.status !== "cancelling");
  const runtimeModel = state ? deriveCustomerRuntimeModel(state) : null;
  const isLiveExecution =
    Boolean(state) &&
    state!.phase === "executing" &&
    (state!.status === "running" || state!.status === "cancelling");
  const showHeaderCancel = Boolean(onCancel && runtimeModel?.canCancel && isLiveExecution);
  const usesCustomBody = Boolean(customBody);
  const desktopShellClass = usesCustomBody
    ? "md:w-[min(560px,calc(100vw-2.5rem))]"
    : isLiveExecution
      ? "md:w-[min(780px,calc(100vw-2.5rem),calc(100dvh-3rem))] md:max-h-[calc(100dvh-3rem)]"
      : "md:w-[min(780px,calc(100vw-2.5rem))]";

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
          "overflow-y-auto",
          isLiveExecution ? "md:overflow-y-auto" : "",
        )}
      >
        <div
          className={cx(
            "mx-auto flex w-full justify-center md:justify-center",
            "max-w-[min(920px,calc(100vw-1rem))] md:max-w-[calc(100vw-2.5rem)]",
            "min-h-full",
            "items-center px-2 py-4 md:px-5 md:py-5",
          )}
        >
          <div className="flex w-full justify-center md:justify-center">
            <div
              className={cx(
                "flex flex-col rounded-[34px] border border-white/10 bg-[#090a0e]/90 shadow-[0_40px_180px_rgba(0,0,0,0.72)] transition-all duration-500",
                "md:p-5",
                isLiveExecution ? "p-0" : "p-3",
                "max-md:w-[min(92vw,420px)] max-md:max-w-[420px] max-md:h-[min(78dvh,640px)] max-md:min-h-[520px] max-md:overflow-hidden max-md:rounded-[24px] max-md:border max-md:border-white/12",
                "md:mx-auto",
                desktopShellClass,
                "max-md:shadow-[0_28px_100px_rgba(0,0,0,0.5)]",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:px-4 md:py-3 md:pt-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-white md:text-[15px]">
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
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-medium text-white/88 md:px-3 md:py-2 md:text-[13px]"
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
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 md:h-10 md:w-10"
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
                    ? "overflow-hidden px-2.5 pb-2.5 pt-2 md:overflow-auto md:p-4"
                    : "overflow-y-auto px-3 pb-3 pt-3 md:p-5",
                )}
              >
                {customBody ? (
                  customBody
                ) : (
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
                    demoImageWatermarkEnabled={demoImageWatermarkEnabled}
                    demoImageWatermarkOwnerHandle={demoImageWatermarkOwnerHandle}
                    hideHeader
                    showInlineExecutionCancel={false}
                    renderExecutionChrome={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalEl,
  );
}
