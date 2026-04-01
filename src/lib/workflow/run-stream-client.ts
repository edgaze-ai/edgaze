"use client";

import type { Dispatch, SetStateAction } from "react";
import { drainReadableStream, streamRunSession } from "./run-session";
import {
  applyWorkflowRunEventToState,
  buildWorkflowRunStateFromBootstrap,
} from "./run-session-state";
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

  let sseHandoffStarted = false;
  let result: any = null;
  const reader = params.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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

          params.runSessionPollRef.current?.abort();
          const sessionController = new AbortController();
          params.runSessionPollRef.current = sessionController;

          void streamRunSession({
            runId: evt.runId,
            accessToken: params.accessToken,
            runAccessToken: typeof evt.runAccessToken === "string" ? evt.runAccessToken : undefined,
            signal: sessionController.signal,
            onTransportState: async (transportState) => {
              params.setRunState((prev) =>
                prev
                  ? {
                      ...prev,
                      connectionState:
                        transportState === "connecting"
                          ? "live"
                          : transportState === "live"
                            ? "live"
                            : transportState === "reconnecting"
                              ? "reconnecting"
                              : "degraded",
                      connectionLabel:
                        transportState === "reconnecting"
                          ? "Reconnecting to live updates..."
                          : transportState === "degraded"
                            ? "Live updates are slower right now."
                            : undefined,
                    }
                  : prev,
              );
            },
            onSnapshot: async (bootstrap) => {
              const nextState = buildWorkflowRunStateFromBootstrap({
                bootstrap,
                workflowId: params.workflowId,
                workflowName: params.workflowName,
                inputValues: params.inputValues,
                runAccessToken:
                  typeof evt.runAccessToken === "string" ? evt.runAccessToken : undefined,
                sourceGraph: params.sourceGraph,
              });
              params.setRunState((prev) =>
                prev
                  ? { ...prev, ...nextState, phase: "executing" }
                  : (nextState as WorkflowRunState),
              );
            },
            onEvent: async (event) => {
              params.setRunState((prev) =>
                prev ? applyWorkflowRunEventToState({ state: prev, event }) : prev,
              );
            },
            onPing: async () => {
              params.setRunState((prev) => (prev ? { ...prev, lastEventAt: Date.now() } : prev));
            },
          }).catch((error) => {
            if (sessionController.signal.aborted) return;
            const message =
              error instanceof Error ? error.message : "Run session stream disconnected.";
            params.setRunState((prev) =>
              prev && prev.status !== "success" && prev.status !== "cancelled"
                ? {
                    ...prev,
                    connectionState: "degraded",
                    connectionLabel: message,
                  }
                : prev,
            );
          });

          sseHandoffStarted = true;
          drainReadableStream(reader);
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

    if (sseHandoffStarted || result) break;
  }

  if (sseHandoffStarted) {
    return { handedOff: true };
  }

  return { handedOff: false, result };
}
