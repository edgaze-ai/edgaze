"use client";

import React from "react";

import { cx } from "../../../lib/cx";
import type { WorkflowRunState } from "../../../lib/workflow/run-types";
import CustomerWorkflowRuntimeSurface from "./CustomerWorkflowRuntimeSurface";

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
  if (!open) return null;

  const canClose = state?.status !== "running" && state?.status !== "cancelling";

  return (
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

      <div className="absolute inset-0 overflow-y-auto">
        <div
          className={cx(
            "mx-auto flex min-h-full w-full max-w-[1440px] justify-center",
            "items-end p-0 md:items-center md:p-6",
          )}
        >
          <div className="w-full max-w-[1180px] max-md:max-w-none md:mx-auto">
            <div
              className={cx(
                "rounded-[34px] border border-white/10 bg-[#090a0e]/90 p-4 shadow-[0_40px_180px_rgba(0,0,0,0.72)] transition-all duration-500 md:p-5",
                "max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0 max-md:border-t max-md:border-white/12",
                "max-md:shadow-[0_-32px_120px_rgba(0,0,0,0.45)] max-md:pt-5 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
