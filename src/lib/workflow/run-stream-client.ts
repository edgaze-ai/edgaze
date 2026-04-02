"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ClientTraceSession } from "./client-trace";
import type { WorkflowRunGraph, WorkflowRunState, WorkflowRunStep } from "./run-types";
import { streamRunSession } from "./run-session";
import {
  applyWorkflowRunEventToState,
  buildWorkflowRunStateFromBootstrap,
} from "./run-session-state";

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
  clientTrace?: ClientTraceSession | null;
};

type HandleWorkflowRunStreamResult =
  | { handedOff: true; result?: undefined }
  | { handedOff: false; result: any };

function parseSseChunk(chunk: string): any | null {
  const lines = chunk.split("\n");
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return JSON.parse(dataLines.join("\n"));
}

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

  const eventTimestamp =
    typeof evt?.timestamp === "number" && Number.isFinite(evt.timestamp)
      ? evt.timestamp
      : Date.now();
  const nextStep: WorkflowRunStep = { id: nodeId, title, status, timestamp: eventTimestamp };
  if (existingIndex >= 0) nextSteps[existingIndex] = { ...existing!, ...nextStep };
  else nextSteps.push(nextStep);

  const now = Date.now();
  const currentStepId =
    status === "running"
      ? nodeId
      : prev.currentStepId === nodeId
        ? null
        : (nextSteps.find((step) => step.status === "running")?.id ?? null);
  return {
    ...prev,
    phase: "executing",
    status: prev.status === "idle" ? "running" : prev.status,
    steps: nextSteps,
    currentStepId,
    connectionState: prev.connectionState === "connecting" ? "live" : prev.connectionState,
    connectionLabel: undefined,
    lastEventAt: now,
  };
}

export async function handleWorkflowRunStream(
  params: HandleWorkflowRunStreamParams,
): Promise<HandleWorkflowRunStreamResult> {
  const contentType = params.response.headers.get("content-type") || "";
  const isSse = contentType.includes("text/event-stream");
  const isStreaming = isSse || contentType.includes("ndjson");
  params.clientTrace?.setClockFromServerEpoch(
    params.response.headers.get("x-trace-server-epoch-ms"),
  );
  params.clientTrace?.record({
    phase: "request",
    eventName: "run_start.response_received",
    httpStatus: params.response.status,
    payload: {
      workflowId: params.workflowId,
      contentType,
      isSse,
      isStreaming,
      traceSessionId: params.response.headers.get("x-trace-session-id"),
    },
  });

  if (!isStreaming || !params.response.body) {
    const result = await params.response.json();
    if (result?.ok && result?.handedOff && typeof result.runId === "string") {
      params.clientTrace?.linkRun({
        workflowRunId: result.runId,
        correlationId: result.runId,
      });
      params.clientTrace?.record({
        phase: "request",
        eventName: "run_start.handoff_received",
        payload: {
          workflowId: params.workflowId,
          runId: result.runId,
          hasRunAccessToken: typeof result.runAccessToken === "string",
        },
      });
      params.runSessionPollRef.current?.abort();
      params.runSessionPollRef.current = new AbortController();

      params.setRunState((prev) =>
        prev
          ? {
              ...prev,
              phase: "executing",
              status: "running",
              runId: result.runId,
              runAccessToken:
                typeof result.runAccessToken === "string"
                  ? result.runAccessToken
                  : prev.runAccessToken,
              connectionState: "connecting",
              connectionLabel: "Connecting to execution...",
              lastEventAt: Date.now(),
            }
          : prev,
      );

      try {
        await streamRunSession({
          runId: result.runId,
          accessToken: params.accessToken,
          runAccessToken:
            typeof result.runAccessToken === "string" ? result.runAccessToken : undefined,
          clientTrace: params.clientTrace,
          signal: params.runSessionPollRef.current.signal,
          onSnapshot: async (bootstrap) => {
            params.setRunState((prev) =>
              prev
                ? {
                    ...prev,
                    ...buildWorkflowRunStateFromBootstrap({
                      bootstrap,
                      workflowId: params.workflowId,
                      workflowName: params.workflowName,
                      inputValues: params.inputValues,
                      runAccessToken:
                        typeof result.runAccessToken === "string"
                          ? result.runAccessToken
                          : prev.runAccessToken,
                      sourceGraph: params.sourceGraph,
                    }),
                  }
                : prev,
            );
          },
          onEvent: async (event) => {
            params.setRunState((prev) =>
              prev ? applyWorkflowRunEventToState({ state: prev, event }) : prev,
            );
          },
          onPing: async () => {
            params.setRunState((prev) =>
              prev && prev.status === "running" ? { ...prev, lastEventAt: Date.now() } : prev,
            );
          },
          onTransportState: async (state) => {
            params.setRunState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                connectionState: state,
                connectionLabel:
                  state === "connecting"
                    ? "Connecting to execution..."
                    : state === "reconnecting"
                      ? "Reconnecting to live updates..."
                      : state === "degraded"
                        ? "Live updates are slow. Reconnecting..."
                        : undefined,
              };
            });
          },
        });
        await params.clientTrace?.finish({ status: "completed" });
      } catch (error) {
        await params.clientTrace?.finish({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Run session stream failed",
        });
        throw error;
      } finally {
        params.runSessionPollRef.current = null;
      }

      return { handedOff: true };
    }
    params.clientTrace?.record({
      phase: "request",
      eventName: "run_start.non_streaming_payload_received",
      payload: {
        workflowId: params.workflowId,
        ok: result?.ok,
        hasResult: Boolean(result?.result),
      },
    });
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
          const evt = isSse ? parseSseChunk(buffer) : JSON.parse(buffer);
          if (evt.type === "complete") result = evt;
        } catch {
          // ignore trailing partial payloads
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = isSse ? buffer.split("\n\n") : buffer.split("\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;

      if (isSse && chunk.trim().startsWith(":")) {
        params.setRunState((prev) =>
          prev && prev.status === "running" ? { ...prev, lastEventAt: Date.now() } : prev,
        );
        continue;
      }

      try {
        const evt = isSse ? parseSseChunk(chunk) : JSON.parse(chunk);
        if (!evt) continue;

        if (evt.type === "run_bootstrap" && typeof evt.runId === "string") {
          params.clientTrace?.linkRun({
            workflowRunId: evt.runId,
            correlationId: evt.runId,
          });
          params.clientTrace?.record({
            phase: "stream",
            eventName: "legacy_stream.bootstrap_received",
            payload: {
              workflowId: params.workflowId,
              runId: evt.runId,
              hasRunAccessToken: typeof evt.runAccessToken === "string",
            },
          });
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
          continue;
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

        if (
          evt?.type === "run.cancel_requested" ||
          evt?.type === "node.stream.started" ||
          evt?.type === "node.stream.delta" ||
          evt?.type === "node.stream.finished"
        ) {
          params.setRunState((prev) =>
            prev ? applyWorkflowRunEventToState({ state: prev, event: evt }) : prev,
          );
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
    await params.clientTrace?.finish({
      status: "failed",
      errorMessage: "Execution stream ended before the server returned a final result.",
    });
    return {
      handedOff: false,
      result: {
        ok: false,
        error: "Execution stream ended before the server returned a final result.",
      },
    };
  }

  await params.clientTrace?.finish({
    status: result?.ok === false ? "failed" : "completed",
    errorMessage: typeof result?.error === "string" ? result.error : null,
  });
  return { handedOff: false, result };
}
