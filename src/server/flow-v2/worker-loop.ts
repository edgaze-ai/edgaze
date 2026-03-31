import { isTerminalNodeStatus } from "./outcome";
import { resolveWorkflowOutcome } from "./outcome-resolver";
import { perfAsync, perfSync } from "./engine-perf";
import { readPayloadReferenceValue } from "./payload-store";
import type {
  ClaimedNodeWorkItem,
  PayloadReference,
  SerializableValue,
  WorkflowOutcome,
  WorkflowRunNode,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from "./types";
import type { NodeExecutor } from "./node-executor";
import type { WorkflowExecutionRepository } from "./repository";
import { executeClaimedNode } from "./node-worker";

type RunState = Awaited<ReturnType<WorkflowExecutionRepository["getRunState"]>>;
type ClassifiedDependency = {
  node: WorkflowRunNode;
  specId: string | undefined;
};
const CONDITION_RESULT_KEY = "__conditionResult";

/** Throttle diagnostic logs when the claim RPC returns no row (avoid log spam each idle tick). */
const lastNoClaimLogAtByRun = new Map<string, number>();
const NO_CLAIM_DIAGNOSTIC_MS = 2000;

function collectDescendantNodeIds(
  startNodeId: string,
  downstreamMap: Record<string, string[]>,
): string[] {
  const visited = new Set<string>();
  const queue = [...(downstreamMap[startNodeId] ?? [])];

  while (queue.length > 0) {
    const nextNodeId = queue.shift();
    if (!nextNodeId || visited.has(nextNodeId)) continue;
    visited.add(nextNodeId);
    queue.push(...(downstreamMap[nextNodeId] ?? []));
  }

  return [...visited];
}

function collectImmediateConditionBranchTargets(params: {
  conditionNodeId: string;
  branchPortId: "true" | "false";
  edges: RunState["compiled"]["edges"];
}): string[] {
  return params.edges
    .filter(
      (edge) =>
        edge.sourceNodeId === params.conditionNodeId && edge.sourcePortId === params.branchPortId,
    )
    .map((edge) => edge.targetNodeId);
}

function collectConditionBranchClosureNodeIds(params: {
  conditionNodeId: string;
  untakenBranchPortId: "true" | "false";
  edges: RunState["compiled"]["edges"];
  downstreamMap: Record<string, string[]>;
}): string[] {
  const untakenTargets = collectImmediateConditionBranchTargets({
    conditionNodeId: params.conditionNodeId,
    branchPortId: params.untakenBranchPortId,
    edges: params.edges,
  });
  const takenTargets = collectImmediateConditionBranchTargets({
    conditionNodeId: params.conditionNodeId,
    branchPortId: params.untakenBranchPortId === "true" ? "false" : "true",
    edges: params.edges,
  });

  const untakenReachable = new Set<string>();
  for (const targetNodeId of untakenTargets) {
    untakenReachable.add(targetNodeId);
    for (const descendantNodeId of collectDescendantNodeIds(targetNodeId, params.downstreamMap)) {
      untakenReachable.add(descendantNodeId);
    }
  }

  const takenReachable = new Set<string>();
  for (const targetNodeId of takenTargets) {
    takenReachable.add(targetNodeId);
    for (const descendantNodeId of collectDescendantNodeIds(targetNodeId, params.downstreamMap)) {
      takenReachable.add(descendantNodeId);
    }
  }

  return [...untakenReachable].filter((nodeId) => !takenReachable.has(nodeId));
}

function mapOutcomeToRunStatus(outcome: WorkflowOutcome): WorkflowRunStatus {
  if (outcome === "failed") return "failed";
  if (outcome === "cancelled") return "cancelled";
  return "completed";
}

function buildFinalOutput(nodes: WorkflowRunNode[]): PayloadReference | null {
  const terminalOutputs: Record<string, SerializableValue> = {};

  for (const node of nodes) {
    if (!node.isTerminalNode || node.status !== "completed" || !node.outputPayload) continue;
    const value = readPayloadReferenceValue(node.outputPayload);
    if (value !== undefined) {
      terminalOutputs[node.nodeId] = value;
    }
  }

  return Object.keys(terminalOutputs).length === 0
    ? null
    : {
        storageKind: "inline",
        contentType: "application/json",
        value: terminalOutputs,
      };
}

function classifyNodeTransition(params: {
  targetNode: WorkflowRunNode;
  dependencies: ClassifiedDependency[];
  runCancelRequested: boolean;
}): {
  status: WorkflowRunNodeStatus;
  reason?: string;
  message: string;
} | null {
  if (isTerminalNodeStatus(params.targetNode.status) || params.targetNode.status === "running") {
    return null;
  }

  if (params.runCancelRequested) {
    return {
      status: "cancelled",
      reason: "run_cancel_requested",
      message: "Cancelled before execution.",
    };
  }

  const dependencyStatuses = params.dependencies.map((dependency) => dependency.node.status);
  const allDependenciesCompleted = dependencyStatuses.every((status) => status === "completed");
  if (allDependenciesCompleted) {
    return {
      status: "ready",
      reason: "all_dependencies_completed",
      message: "All dependencies completed.",
    };
  }

  const unresolvedDependencyExists = dependencyStatuses.some(
    (status) =>
      status === "pending" ||
      status === "ready" ||
      status === "queued" ||
      status === "retry_scheduled" ||
      status === "running",
  );
  if (unresolvedDependencyExists) {
    return null;
  }

  const cancelledDependencyExists = dependencyStatuses.some((status) => status === "cancelled");
  if (cancelledDependencyExists) {
    return {
      status: "cancelled",
      reason: "upstream_cancelled",
      message: "Cancelled because an upstream dependency was cancelled.",
    };
  }

  const skippedDependencies = params.dependencies.filter(
    (dependency) => dependency.node.status === "skipped" || dependency.node.status === "blocked",
  );
  if (skippedDependencies.length > 0) {
    const skippedByCondition = skippedDependencies.some(
      (dependency) => dependency.specId === "condition",
    );
    return skippedByCondition
      ? {
          status: "skipped",
          reason: "condition_path_closed",
          message: "Skipped by condition path closure.",
        }
      : {
          status: "skipped",
          reason: "upstream_path_closed",
          message: "Skipped because an upstream path was closed.",
        };
  }

  const failingDependencies = params.dependencies.filter(
    (dependency) => dependency.node.status === "failed" || dependency.node.status === "timed_out",
  );

  if (failingDependencies.length > 0) {
    const skipRequested = failingDependencies.some(
      (dependency) =>
        dependency.node.failurePolicy === "skip_downstream" ||
        dependency.node.failurePolicy === "fail_fast",
    );
    return skipRequested
      ? {
          status: "skipped",
          reason: "upstream_failure_policy",
          message: "Skipped because an upstream failure closed this branch.",
        }
      : {
          status: "blocked",
          reason: "upstream_failed_without_output",
          message: "Upstream dependency failed without output.",
        };
  }

  return null;
}

async function reevaluateNodeTransitions(params: {
  repository: WorkflowExecutionRepository;
  runId: string;
  runState: RunState;
  nodes: WorkflowRunNode[];
}): Promise<WorkflowRunNode[]> {
  const { runId } = params;
  const { readyNodeIds, blockedNodeIds, skippedNodeIds, cancelledNodeIds, transitionMetaByNodeId } =
    perfSync(runId, "reevaluate.planTransitions_sync", () => {
      const nodeById = new Map(params.nodes.map((node) => [node.nodeId, node]));
      const compiledNodeById = new Map(
        params.runState.compiled.nodes.map((node) => [node.id, node]),
      );
      const ready: string[] = [];
      const blocked: string[] = [];
      const skipped: string[] = [];
      const cancelled: string[] = [];
      const transitionMetaByNodeIdInner = new Map<string, { reason?: string; message: string }>();

      for (const compiledNode of params.runState.compiled.nodes) {
        const targetNode = nodeById.get(compiledNode.id);
        if (!targetNode) continue;

        const dependencyNodes = compiledNode.dependencyNodeIds
          .map((dependencyNodeId) => {
            const dependencyNode = nodeById.get(dependencyNodeId);
            if (!dependencyNode) return null;
            return {
              node: dependencyNode,
              specId: compiledNodeById.get(dependencyNodeId)?.specId,
            };
          })
          .filter((dependency): dependency is ClassifiedDependency => dependency !== null);

        const nextStatus = classifyNodeTransition({
          targetNode,
          dependencies: dependencyNodes,
          runCancelRequested: Boolean(params.runState.cancelRequestedAt),
        });

        if (!nextStatus || nextStatus.status === targetNode.status) continue;

        transitionMetaByNodeIdInner.set(targetNode.nodeId, {
          reason: nextStatus.reason,
          message: nextStatus.message,
        });
        if (nextStatus.status === "ready") ready.push(targetNode.nodeId);
        else if (nextStatus.status === "blocked") blocked.push(targetNode.nodeId);
        else if (nextStatus.status === "skipped") skipped.push(targetNode.nodeId);
        else if (nextStatus.status === "cancelled") cancelled.push(targetNode.nodeId);
      }

      return {
        readyNodeIds: ready,
        blockedNodeIds: blocked,
        skippedNodeIds: skipped,
        cancelledNodeIds: cancelled,
        transitionMetaByNodeId: transitionMetaByNodeIdInner,
      };
    });

  const changedNodeIds = new Set<string>();
  const now = new Date().toISOString();

  const changedReadyNodeIds = await perfAsync(runId, "reevaluate.db.updateNodeStatuses.ready", () =>
    params.repository.updateNodeStatuses({
      runId: params.runId,
      nodeIds: readyNodeIds,
      status: "ready",
      onlyCurrentStatuses: ["pending", "queued", "retry_scheduled"],
      queuedAt: now,
    }),
  );
  const readyEvents = changedReadyNodeIds.map((nodeId) => {
    changedNodeIds.add(nodeId);
    const transitionMeta = transitionMetaByNodeId.get(nodeId);
    return {
      type: "node.ready" as const,
      nodeId,
      payload: {
        nodeId,
        status: "ready" as const,
        message: transitionMeta?.message ?? "All dependencies completed.",
        reason: transitionMeta?.reason,
      },
    };
  });
  await perfAsync(runId, "reevaluate.db.appendRunEvents.ready", () =>
    params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: readyEvents,
    }),
  );

  const changedBlockedNodeIds = await perfAsync(
    runId,
    "reevaluate.db.updateNodeStatuses.blocked",
    () =>
      params.repository.updateNodeStatuses({
        runId: params.runId,
        nodeIds: blockedNodeIds,
        status: "blocked",
        onlyCurrentStatuses: ["pending", "ready", "queued", "retry_scheduled"],
        endedAt: now,
      }),
  );
  const blockedEvents = changedBlockedNodeIds.map((nodeId) => {
    changedNodeIds.add(nodeId);
    const transitionMeta = transitionMetaByNodeId.get(nodeId);
    return {
      type: "node.blocked" as const,
      nodeId,
      payload: {
        nodeId,
        status: "blocked" as const,
        message: transitionMeta?.message ?? "Upstream dependency failed without output.",
        reason: transitionMeta?.reason,
      },
    };
  });
  await perfAsync(runId, "reevaluate.db.appendRunEvents.blocked", () =>
    params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: blockedEvents,
    }),
  );

  const changedSkippedNodeIds = await perfAsync(
    runId,
    "reevaluate.db.updateNodeStatuses.skipped",
    () =>
      params.repository.updateNodeStatuses({
        runId: params.runId,
        nodeIds: skippedNodeIds,
        status: "skipped",
        onlyCurrentStatuses: ["pending", "ready", "queued", "retry_scheduled"],
        endedAt: now,
      }),
  );
  const skippedEvents = changedSkippedNodeIds.map((nodeId) => {
    changedNodeIds.add(nodeId);
    const transitionMeta = transitionMetaByNodeId.get(nodeId);
    return {
      type: "node.skipped" as const,
      nodeId,
      payload: {
        nodeId,
        status: "skipped" as const,
        message: transitionMeta?.message ?? "Skipped due to upstream policy or path closure.",
        reason: transitionMeta?.reason,
      },
    };
  });
  await perfAsync(runId, "reevaluate.db.appendRunEvents.skipped", () =>
    params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: skippedEvents,
    }),
  );

  const changedCancelledNodeIds = await perfAsync(
    runId,
    "reevaluate.db.updateNodeStatuses.cancelled",
    () =>
      params.repository.updateNodeStatuses({
        runId: params.runId,
        nodeIds: cancelledNodeIds,
        status: "cancelled",
        onlyCurrentStatuses: ["pending", "ready", "queued", "retry_scheduled"],
        endedAt: now,
      }),
  );
  const cancelledEvents = changedCancelledNodeIds.map((nodeId) => {
    changedNodeIds.add(nodeId);
    const transitionMeta = transitionMetaByNodeId.get(nodeId);
    return {
      type: "node.cancelled" as const,
      nodeId,
      payload: {
        nodeId,
        status: "cancelled" as const,
        message: transitionMeta?.message ?? "Cancelled before execution.",
        reason: transitionMeta?.reason,
      },
    };
  });
  await perfAsync(runId, "reevaluate.db.appendRunEvents.cancelled", () =>
    params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: cancelledEvents,
    }),
  );

  if (changedNodeIds.size === 0) {
    return params.nodes;
  }

  return perfAsync(runId, "reevaluate.db.listRunNodes_afterTransition", () =>
    params.repository.listRunNodes(params.runId),
  );
}

async function finalizeRunIfTerminal(params: {
  repository: WorkflowExecutionRepository;
  runId: string;
  runState: RunState;
  nodes: WorkflowRunNode[];
}): Promise<boolean> {
  if (params.nodes.length === 0) return false;

  const allNodesTerminal = params.nodes.every((node) => isTerminalNodeStatus(node.status));
  if (!allNodesTerminal) return false;

  const outcome = resolveWorkflowOutcome({
    runStatus: params.runState.cancelRequestedAt ? "cancelling" : params.runState.status,
    nodes: params.nodes,
  });

  await params.repository.finalizeRun({
    runId: params.runId,
    status: mapOutcomeToRunStatus(outcome),
    outcome,
    finalOutput: buildFinalOutput(params.nodes),
    terminalReason: outcome,
  });

  await params.repository.appendRunEvent({
    runId: params.runId,
    type: "run.completed",
    payload: {
      outcome,
      status: mapOutcomeToRunStatus(outcome),
      nodeCount: params.nodes.length,
    },
  });

  return true;
}

async function applyTerminalNodeEffects(params: {
  repository: WorkflowExecutionRepository;
  runId: string;
  runState: RunState;
  workItem: ClaimedNodeWorkItem;
  result: Awaited<ReturnType<typeof executeClaimedNode>>;
}): Promise<void> {
  const attemptEventType =
    params.result.status === "completed"
      ? "node_attempt_succeeded"
      : params.result.status === "cancelled"
        ? "node_attempt_failed"
        : params.result.status === "timed_out"
          ? "node_attempt_failed"
          : "node_attempt_failed";
  const completedEventType =
    params.result.status === "completed"
      ? "node.completed"
      : params.result.status === "cancelled"
        ? "node.cancelled"
        : "node.failed";

  const finalizedStatus =
    params.result.status === "completed"
      ? "completed"
      : params.result.status === "cancelled"
        ? "cancelled"
        : params.result.status === "timed_out"
          ? "timed_out"
          : "failed";
  await params.repository.appendRunEventsBatch({
    runId: params.runId,
    events: [
      {
        type: attemptEventType,
        nodeId: params.workItem.compiledNode.id,
        attemptNumber: params.workItem.attemptNumber,
        payload: {
          nodeId: params.workItem.compiledNode.id,
          attemptNumber: params.workItem.attemptNumber,
          status: finalizedStatus,
          message: params.result.error?.message,
        },
      },
      {
        type: completedEventType,
        nodeId: params.workItem.compiledNode.id,
        attemptNumber: params.workItem.attemptNumber,
        payload: {
          nodeId: params.workItem.compiledNode.id,
          attemptNumber: params.workItem.attemptNumber,
          status: finalizedStatus,
          message: params.result.error?.message,
        },
      },
      {
        type: "node_finalized",
        nodeId: params.workItem.compiledNode.id,
        attemptNumber: params.workItem.attemptNumber,
        payload: {
          nodeId: params.workItem.compiledNode.id,
          attemptNumber: params.workItem.attemptNumber,
          status: finalizedStatus,
          message: params.result.error?.message,
        },
      },
    ],
  });

  if (
    params.result.status === "completed" &&
    params.workItem.compiledNode.specId === "condition" &&
    params.result.outputsByPort
  ) {
    const branchTaken = Boolean(params.result.outputsByPort[CONDITION_RESULT_KEY]);
    const untakenBranchPortId = branchTaken ? "false" : "true";
    const conditionClosedNodeIds = collectConditionBranchClosureNodeIds({
      conditionNodeId: params.workItem.compiledNode.id,
      untakenBranchPortId,
      edges: params.runState.compiled.edges,
      downstreamMap: params.runState.compiled.downstreamMap,
    });

    const skippedNodeIds = await params.repository.updateNodeStatuses({
      runId: params.runId,
      nodeIds: conditionClosedNodeIds,
      status: "skipped",
      onlyCurrentStatuses: ["pending", "ready", "queued", "retry_scheduled"],
      endedAt: new Date().toISOString(),
    });

    await params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: skippedNodeIds.map((nodeId) => ({
        type: "node.skipped" as const,
        nodeId,
        payload: {
          nodeId,
          status: "skipped" as const,
          message: `Condition branch not taken (${untakenBranchPortId}).`,
          reason: "condition_branch_not_taken",
        },
      })),
    });
  }

  if (
    (params.result.status === "failed" || params.result.status === "timed_out") &&
    params.workItem.compiledNode.failurePolicy === "fail_fast"
  ) {
    const descendantNodeIds = collectDescendantNodeIds(
      params.workItem.compiledNode.id,
      params.runState.compiled.downstreamMap,
    );

    const skippedNodeIds = await params.repository.updateNodeStatuses({
      runId: params.runId,
      nodeIds: descendantNodeIds,
      status: "skipped",
      onlyCurrentStatuses: ["pending", "ready", "queued", "retry_scheduled"],
      endedAt: new Date().toISOString(),
    });

    await params.repository.appendRunEventsBatch({
      runId: params.runId,
      events: skippedNodeIds.map((nodeId) => ({
        type: "node.skipped" as const,
        nodeId,
        payload: {
          nodeId,
          status: "skipped" as const,
          message: `Skipped because upstream node "${params.workItem.compiledNode.id}" failed fast.`,
          reason: "upstream_failed_fast",
        },
      })),
    });
  }
}

export interface WorkflowWorkerLoopDependencies {
  repository: WorkflowExecutionRepository;
  executor: NodeExecutor;
  workerId: string;
  leaseDurationSec?: number;
  leaseHeartbeatMs?: number;
  requestMetadata?: {
    userId?: string | null;
    identifier?: string;
    identifierType?: "ip" | "device" | "user";
    workflowId?: string;
  };
}

function createChildAbortController(parentSignal: AbortSignal): AbortController {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort(
      parentSignal.reason instanceof Error ? parentSignal.reason : new Error("Worker aborted"),
    );
  };

  if (parentSignal.aborted) {
    onAbort();
  } else {
    parentSignal.addEventListener("abort", onAbort, { once: true });
  }

  controller.signal.addEventListener(
    "abort",
    () => {
      parentSignal.removeEventListener("abort", onAbort);
    },
    { once: true },
  );

  return controller;
}

export interface ProcessNextRunNodeResult {
  state: "processed" | "idle" | "finalized";
  processed: boolean;
  /** Nodes executed in this iteration (parallel batch may be > 1). */
  processedNodeCount: number;
}

function buildNodeStartedEvents(workItem: ClaimedNodeWorkItem) {
  return [
    {
      type: "node.started" as const,
      nodeId: workItem.compiledNode.id,
      attemptNumber: workItem.attemptNumber,
      payload: {
        nodeId: workItem.compiledNode.id,
        attemptNumber: workItem.attemptNumber,
        status: "running" as const,
        message: "Node execution started.",
      },
    },
    {
      type: "node_attempt_started" as const,
      nodeId: workItem.compiledNode.id,
      attemptNumber: workItem.attemptNumber,
      payload: {
        nodeId: workItem.compiledNode.id,
        attemptNumber: workItem.attemptNumber,
        status: "running" as const,
        message: "Attempt execution started.",
      },
    },
  ];
}

async function executeClaimedNodeWithLeaseHeartbeat(params: {
  workItem: ClaimedNodeWorkItem;
  signal: AbortSignal;
  dependencies: WorkflowWorkerLoopDependencies;
}): Promise<Awaited<ReturnType<typeof executeClaimedNode>>> {
  const executionSignalController = createChildAbortController(params.signal);
  const heartbeatMs = params.dependencies.leaseHeartbeatMs ?? 10_000;
  const heartbeat = setInterval(
    async () => {
      try {
        const renewed = await params.dependencies.repository.renewAttemptLease({
          attemptId: params.workItem.attemptId,
          leaseOwner: params.workItem.leaseOwner,
          leaseDurationSec: params.dependencies.leaseDurationSec,
        });
        if (!renewed && !executionSignalController.signal.aborted) {
          executionSignalController.abort(new Error("Attempt lease lost before completion."));
        }
      } catch (error) {
        if (!executionSignalController.signal.aborted) {
          executionSignalController.abort(
            error instanceof Error ? error : new Error("Attempt lease renewal failed."),
          );
        }
      }
    },
    Math.max(heartbeatMs, 1_000),
  );

  try {
    return await executeClaimedNode({
      workItem: params.workItem,
      repository: params.dependencies.repository,
      executor: params.dependencies.executor,
      signal: executionSignalController.signal,
      requestMetadata: params.dependencies.requestMetadata,
    });
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Claims up to `maxConcurrent` runnable nodes (all are mutually non-blocking: status ready/queued
 * implies dependencies are satisfied) and executes them concurrently. Side effects that affect the
 * graph (condition skips, fail-fast) are applied in topo order after all attempts finish.
 */
export async function processNextRunnableBatch(params: {
  runId: string;
  signal: AbortSignal;
  dependencies: WorkflowWorkerLoopDependencies;
  maxConcurrent?: number;
}): Promise<ProcessNextRunNodeResult> {
  const runId = params.runId;
  const maxConcurrent = Math.max(1, params.maxConcurrent ?? 12);
  const runState = await perfAsync(runId, "batch.getRunState", () =>
    params.dependencies.repository.getRunState({ runId }),
  );

  if (
    runState.status === "completed" ||
    runState.status === "failed" ||
    runState.status === "cancelled"
  ) {
    return { state: "finalized", processed: false, processedNodeCount: 0 };
  }

  const workItems: ClaimedNodeWorkItem[] = [];
  while (workItems.length < maxConcurrent) {
    const workItem = await perfAsync(runId, "batch.claimNextRunnableNode", () =>
      params.dependencies.repository.claimNextRunnableNode({
        runId: params.runId,
        workerId: params.dependencies.workerId,
        leaseDurationSec: params.dependencies.leaseDurationSec,
      }),
    );
    if (!workItem) break;
    workItems.push(workItem);
  }

  if (workItems.length === 0) {
    const nodes = await perfAsync(runId, "batch.idle.listRunNodes", () =>
      params.dependencies.repository.listRunNodes(params.runId),
    );
    const now = Date.now();
    const prevLog = lastNoClaimLogAtByRun.get(params.runId) ?? 0;
    if (now - prevLog >= NO_CLAIM_DIAGNOSTIC_MS) {
      lastNoClaimLogAtByRun.set(params.runId, now);
      const nodeStatusCounts: Record<string, number> = {};
      for (const n of nodes) {
        nodeStatusCounts[n.status] = (nodeStatusCounts[n.status] ?? 0) + 1;
      }
      console.warn("[flow-v2] No claimable node (idle cycle)", {
        runId: params.runId,
        runStatus: runState.status,
        cancelRequestedAt: runState.cancelRequestedAt,
        nodeStatusCounts,
      });
    }
    const finalized = await perfAsync(runId, "batch.idle.finalizeRunIfTerminal", () =>
      finalizeRunIfTerminal({
        repository: params.dependencies.repository,
        runId: params.runId,
        runState,
        nodes,
      }),
    );
    if (finalized) {
      lastNoClaimLogAtByRun.delete(params.runId);
    }
    return {
      state: finalized ? "finalized" : "idle",
      processed: false,
      processedNodeCount: 0,
    };
  }

  await perfAsync(runId, "batch.appendNodeStartedEvents_all", async () => {
    await params.dependencies.repository.appendRunEventsBatch({
      runId: params.runId,
      events: workItems.flatMap((workItem) => buildNodeStartedEvents(workItem)),
    });
  });

  const results = await perfAsync(runId, "batch.executeNodesParallel_withLease", () =>
    Promise.all(
      workItems.map((workItem) =>
        executeClaimedNodeWithLeaseHeartbeat({
          workItem,
          signal: params.signal,
          dependencies: params.dependencies,
        }),
      ),
    ),
  );

  const ordered = perfSync(runId, "batch.sortCompletedWorkTopo", () =>
    workItems
      .map((workItem, index) => ({
        workItem,
        result: results[index]!,
      }))
      .sort((a, b) => {
        const ti = a.workItem.compiledNode.topoIndex - b.workItem.compiledNode.topoIndex;
        if (ti !== 0) return ti;
        return a.workItem.compiledNode.id.localeCompare(b.workItem.compiledNode.id);
      }),
  );

  await perfAsync(runId, "batch.applyTerminalNodeEffects_all", async () => {
    for (const { workItem, result } of ordered) {
      await applyTerminalNodeEffects({
        repository: params.dependencies.repository,
        runId: params.runId,
        runState,
        workItem,
        result,
      });
    }
  });

  const reevaluatedNodes = await reevaluateNodeTransitions({
    repository: params.dependencies.repository,
    runId: params.runId,
    runState,
    nodes: await perfAsync(runId, "batch.listRunNodes_beforeReevaluate", () =>
      params.dependencies.repository.listRunNodes(params.runId),
    ),
  });

  const finalized = await perfAsync(runId, "batch.finalizeRunIfTerminal", () =>
    finalizeRunIfTerminal({
      repository: params.dependencies.repository,
      runId: params.runId,
      runState,
      nodes: reevaluatedNodes,
    }),
  );

  return {
    state: finalized ? "finalized" : "processed",
    processed: true,
    processedNodeCount: workItems.length,
  };
}

/** Single-node batch; use {@link processNextRunnableBatch} for parallel independent steps. */
export async function processNextRunNode(params: {
  runId: string;
  signal: AbortSignal;
  dependencies: WorkflowWorkerLoopDependencies;
}): Promise<ProcessNextRunNodeResult> {
  return processNextRunnableBatch({ ...params, maxConcurrent: 1 });
}
