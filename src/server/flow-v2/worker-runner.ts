import {
  logWorkflowEnginePerfTotals,
  perfAsync,
  resetWorkflowEnginePerfTotals,
} from "./engine-perf";
import type { NodeExecutor } from "./node-executor";
import type { WorkflowExecutionRepository } from "./repository";
import { processNextRunnableBatch, type WorkflowWorkerLoopDependencies } from "./worker-loop";

export class WorkflowRunnerAbortedError extends Error {
  constructor(message = "Workflow runner aborted") {
    super(message);
    this.name = "WorkflowRunnerAbortedError";
  }
}

export class WorkflowRunnerStalledError extends Error {
  constructor(message = "Workflow runner stalled before reaching a terminal run state") {
    super(message);
    this.name = "WorkflowRunnerStalledError";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw new WorkflowRunnerAbortedError();
}

async function waitWithAbort(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) return;
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason instanceof Error ? signal.reason : new WorkflowRunnerAbortedError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface WorkflowRunnerOptions {
  maxIterations?: number;
  maxConsecutiveIdleCycles?: number;
  idleBackoffMs?: number;
  leaseDurationSec?: number;
  leaseHeartbeatMs?: number;
  /** Run this many mutually-ready nodes in parallel per iteration (DAG-safe). Default 12. */
  maxConcurrentNodes?: number;
}

export interface WorkflowRunnerResult {
  iterations: number;
  processedCount: number;
  idleCount: number;
  terminalState: "finalized" | "aborted";
}

export interface WorkflowRunnerDependencies extends WorkflowWorkerLoopDependencies {
  repository: WorkflowExecutionRepository;
  executor: NodeExecutor;
}

export async function runWorkflowToTerminal(params: {
  runId: string;
  signal: AbortSignal;
  dependencies: WorkflowRunnerDependencies;
  options?: WorkflowRunnerOptions;
}): Promise<WorkflowRunnerResult> {
  const maxIterations = params.options?.maxIterations ?? 10_000;
  const maxConsecutiveIdleCycles = params.options?.maxConsecutiveIdleCycles ?? 3;
  const idleBackoffMs = params.options?.idleBackoffMs ?? 50;
  const maxConcurrentNodes = params.options?.maxConcurrentNodes ?? 12;

  let iterations = 0;
  let processedCount = 0;
  let consecutiveIdleCycles = 0;

  resetWorkflowEnginePerfTotals(params.runId);

  while (iterations < maxIterations) {
    throwIfAborted(params.signal);
    iterations += 1;

    const result = await processNextRunnableBatch({
      runId: params.runId,
      signal: params.signal,
      maxConcurrent: maxConcurrentNodes,
      dependencies: {
        ...params.dependencies,
        leaseDurationSec: params.options?.leaseDurationSec ?? params.dependencies.leaseDurationSec,
        leaseHeartbeatMs: params.options?.leaseHeartbeatMs ?? params.dependencies.leaseHeartbeatMs,
      },
    });

    if (result.processed) {
      processedCount += result.processedNodeCount;
    }

    if (result.state === "processed") {
      consecutiveIdleCycles = 0;
      continue;
    }

    if (result.state === "finalized") {
      logWorkflowEnginePerfTotals(params.runId, "run_finalized");
      return {
        iterations,
        processedCount,
        idleCount: consecutiveIdleCycles,
        terminalState: "finalized",
      };
    }

    consecutiveIdleCycles += 1;
    if (consecutiveIdleCycles > maxConsecutiveIdleCycles) {
      logWorkflowEnginePerfTotals(params.runId, "runner_stalled_idle");
      throw new WorkflowRunnerStalledError(
        `Workflow run "${params.runId}" stayed idle for ${consecutiveIdleCycles} consecutive cycles without reaching a terminal state.`,
      );
    }

    await perfAsync(params.runId, "runner.idleBackoff_wait", () => waitWithAbort(idleBackoffMs, params.signal));
  }

  logWorkflowEnginePerfTotals(params.runId, "runner_exceeded_iterations");
  throw new WorkflowRunnerStalledError(
    `Workflow run "${params.runId}" exceeded the worker iteration limit (${maxIterations}).`,
  );
}
