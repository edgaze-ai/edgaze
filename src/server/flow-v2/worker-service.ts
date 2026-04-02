import { failWorkflowRunIfNonTerminal } from "@lib/supabase/executions";
import { getOrCreateTraceSession, releaseTraceSession } from "src/server/trace";

import { LegacyNodeExecutorAdapter } from "./node-executor";
import type { WorkflowRunnerDependencies } from "./worker-runner";
import {
  runWorkflowToTerminal,
  WorkflowRunnerAbortedError,
  WorkflowRunnerStalledError,
} from "./worker-runner";
import type { WorkflowExecutionRepository } from "./repository";

/**
 * Multi-instance serverless (e.g. Vercel): POST /api/flow/run and GET /api/runs/:id/stream may hit
 * different instances; this in-memory registry only coordinates work within one process. Prefer pinning
 * the worker to the long-lived SSE request (see stream route) or use waitUntil / an external queue worker
 * for durable cross-instance execution.
 */

type ActiveRunWorker = {
  runId: string;
  controller: AbortController;
  promise: Promise<void>;
  getError: () => Error | null;
};

declare global {
  var __edgazeWorkflowRunWorkers: Map<string, ActiveRunWorker> | undefined;
}

function getWorkerRegistry(): Map<string, ActiveRunWorker> {
  if (!globalThis.__edgazeWorkflowRunWorkers) {
    globalThis.__edgazeWorkflowRunWorkers = new Map<string, ActiveRunWorker>();
  }
  return globalThis.__edgazeWorkflowRunWorkers;
}

export function getActiveWorkflowRunWorker(runId: string): ActiveRunWorker | null {
  return getWorkerRegistry().get(runId) ?? null;
}

export function cancelWorkflowRunWorker(runId: string): boolean {
  const activeWorker = getActiveWorkflowRunWorker(runId);
  if (!activeWorker) return false;
  activeWorker.controller.abort(new WorkflowRunnerAbortedError("Workflow run cancelled."));
  return true;
}

export function ensureWorkflowRunWorker(params: {
  runId: string;
  repository: WorkflowExecutionRepository;
  requestMetadata?: WorkflowRunnerDependencies["requestMetadata"];
  workerId?: string;
}): ActiveRunWorker {
  const registry = getWorkerRegistry();
  const existing = registry.get(params.runId);
  if (existing) return existing;

  const trace = getOrCreateTraceSession(`workflow:${params.runId}`, {
    id: `workflow:${params.runId}`,
    kind: "workflow",
    source: "workflow",
    phase: "worker",
    routeId: "workflow.worker",
    method: "WORKER",
    workflowId: params.requestMetadata?.workflowId ?? null,
    workflowRunId: params.runId,
    correlationId: params.runId,
    actorId: params.requestMetadata?.userId ?? null,
    context: {
      workerId: params.workerId ?? `worker-service:${params.runId}`,
      requestMetadata: params.requestMetadata ?? null,
    },
  });
  void trace.record({
    phase: "worker",
    source: "workflow",
    eventName: "worker.ensure_requested",
    payload: {
      runId: params.runId,
      workerId: params.workerId ?? `worker-service:${params.runId}`,
    },
  });

  const controller = new AbortController();
  let workerError: Error | null = null;
  const promise = runWorkflowToTerminal({
    runId: params.runId,
    signal: controller.signal,
    dependencies: {
      repository: params.repository,
      executor: new LegacyNodeExecutorAdapter(),
      workerId: params.workerId ?? `worker-service:${params.runId}`,
      requestMetadata: params.requestMetadata,
    },
  })
    .catch(async (err: unknown) => {
      workerError = err instanceof Error ? err : new Error("Workflow runner failed");
      await trace.record({
        phase: "worker",
        source: "workflow",
        eventName: "worker.failed",
        severity: "error",
        payload: {
          runId: params.runId,
          workerId: params.workerId ?? `worker-service:${params.runId}`,
          error: workerError.message,
          stack: workerError.stack,
        },
      });
      console.error(
        `[worker-service] Run ${params.runId} failed:`,
        workerError.message,
        workerError.stack,
      );

      if (err instanceof WorkflowRunnerAbortedError) {
        return;
      }

      const isStall = err instanceof WorkflowRunnerStalledError;
      const persisted = await failWorkflowRunIfNonTerminal(params.runId, {
        code: isStall ? "runner_stalled" : "runner_error",
        message: workerError.message,
        name: workerError.name,
      });
      if (!persisted) {
        console.warn(
          `[worker-service] Run ${params.runId} failure not persisted (run may already be terminal).`,
        );
      }
    })
    .then(async () => {
      await trace.record({
        phase: "worker",
        source: "workflow",
        eventName: "worker.completed",
        payload: {
          runId: params.runId,
          workerId: params.workerId ?? `worker-service:${params.runId}`,
          hadError: Boolean(workerError),
        },
      });
      await trace.finish({
        status: workerError ? "failed" : "completed",
        errorMessage: workerError?.message ?? null,
      });
      return undefined as void;
    })
    .finally(() => {
      const current = registry.get(params.runId);
      if (current?.controller === controller) {
        registry.delete(params.runId);
      }
      releaseTraceSession(`workflow:${params.runId}`);
    });

  const activeWorker: ActiveRunWorker = {
    runId: params.runId,
    controller,
    promise,
    getError: () => workerError,
  };
  registry.set(params.runId, activeWorker);
  return activeWorker;
}
