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
          "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(98,190,255,0.10),transparent_34%),rgba(3,3,6,0.92)] backdrop-blur-xl transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => {
          if (canClose) onClose();
        }}
      />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1440px] items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-[1180px]">
            <div
              className={cx(
                "rounded-[34px] border border-white/10 bg-[#090a0e]/85 p-4 shadow-[0_40px_180px_rgba(0,0,0,0.72)] transition-all duration-500 md:p-5",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <CustomerWorkflowRuntimeSurface
                state={state}
                onCancel={onCancel}
                onClose={canClose ? onClose : undefined}
                onRerun={onRerun}
                onSubmitInputs={onSubmitInputs}
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
