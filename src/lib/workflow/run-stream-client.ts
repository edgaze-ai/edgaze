"use client";

import type { Dispatch, SetStateAction } from "react";
import type { WorkflowRunGraph, WorkflowRunState, WorkflowRunStep } from "./run-types";

type WorkflowRunStateRef = {
  current: AbortController | null;
};

type HandleWorkflowRunStreamParams = {
  response: Response;
  accessToken?: string | null;
  runSessionPollRef: WorkflowRunStateRef;
  setRunState: Dispatch<SetStateAction<WorkflowRunState | null>>;
  workflowId: string;
  workflowName: string;
  inputValues: Record<string, unknown>;
  sourceGraph?: WorkflowRunGraph;
};

type HandleWorkflowRunStreamResult =
  | { handedOff: true; result?: undefined }
  | { handedOff: false; result: any };

function applyLegacyProgressEvent(prev: WorkflowRunState, evt: any): WorkflowRunState {
  const type = String(evt?.type ?? "");
  const nodeId = typeof evt?.nodeId === "string" ? evt.nodeId : null;
  if (!nodeId) return prev;

  const nextSteps = [...(prev.steps ?? [])];
  const existingIndex = nextSteps.findIndex((step) => step.id === nodeId);
  const existing = existingIndex >= 0 ? nextSteps[existingIndex] : null;
  const fallbackSpecId =
    prev.graph?.nodes?.find((node) => node?.id === nodeId)?.data?.specId ?? "default";
  const title =
    (typeof evt?.nodeTitle === "string" && evt.nodeTitle.trim()) ||
    existing?.title ||
    (prev.graph?.nodes?.find((node) => node?.id === nodeId)?.data?.title as string) ||
    fallbackSpecId;

  const status: WorkflowRunStep["status"] =
    type === "node_ready"
      ? "queued"
      : type === "node_start"
        ? "running"
        : type === "node_done"
          ? "done"
          : "error";

  const nextStep: WorkflowRunStep = { id: nodeId, title, status };
  if (existingIndex >= 0) nextSteps[existingIndex] = { ...existing!, ...nextStep };
  else nextSteps.push(nextStep);

  const now = Date.now();
  return {
    ...prev,
    phase: "executing",
    status: prev.status === "idle" ? "running" : prev.status,
    steps: nextSteps,
    currentStepId: status === "running" ? nodeId : prev.currentStepId,
    connectionState: prev.connectionState === "connecting" ? "live" : prev.connectionState,
    connectionLabel: undefined,
    lastEventAt: now,
  };
}

export async function handleWorkflowRunStream(
  params: HandleWorkflowRunStreamParams,
): Promise<HandleWorkflowRunStreamResult> {
  const contentType = params.response.headers.get("content-type") || "";
  const isStreaming = contentType.includes("ndjson");

  if (!isStreaming || !params.response.body) {
    const result = await params.response.json();
    return { handedOff: false, result };
  }

  let result: any = null;
  const reader = params.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  params.runSessionPollRef.current?.abort();
  params.runSessionPollRef.current = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer);
          if (evt.type === "complete") result = evt;
        } catch {
          // ignore trailing partial payloads
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const evt = JSON.parse(line);

        if (evt.type === "run_bootstrap" && typeof evt.runId === "string") {
          params.setRunState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "executing",
                  status: "running",
                  connectionState: "live",
                  connectionLabel: undefined,
                  lastEventAt: Date.now(),
                  runId: evt.runId,
                  runAccessToken:
                    typeof evt.runAccessToken === "string"
                      ? evt.runAccessToken
                      : prev.runAccessToken,
                }
              : prev,
          );
          break;
        }

        if (
          evt?.type === "node_ready" ||
          evt?.type === "node_start" ||
          evt?.type === "node_done" ||
          evt?.type === "node_failed"
        ) {
          params.setRunState((prev) => (prev ? applyLegacyProgressEvent(prev, evt) : prev));
          continue;
        }

        if (evt.type === "complete") {
          result = evt;
        }
      } catch {
        // Ignore malformed NDJSON lines and continue listening for the stream handoff.
      }
    }
    if (result) break;
  }

  if (!result) {
    return {
      handedOff: false,
      result: {
        ok: false,
        error: "Execution stream ended before the server returned a final result.",
      },
    };
  }

  return { handedOff: false, result };
}
