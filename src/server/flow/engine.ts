import type {
  FlowProgressEvent,
  GraphEdge,
  GraphNode,
  GraphPayload,
  NodeRuntimeHandler,
  NodeTrace,
  RuntimeContext,
  RuntimeResult,
  RunLogEntry,
} from "./types";
import { ExecutionStateManager } from "./execution-state";
import { runtimeRegistry } from "../nodes/handlers";
import {
  getFailurePolicy,
  getFallbackValue,
  getEdgeGating,
  satisfiesEdgeGating,
  type EdgeGating,
} from "@lib/workflow/workflow-policy";
import { coerceInbound, nodeHasSideEffects } from "@lib/workflow/node-contracts";
import { CONDITION_RESULT_KEY } from "../nodes/handlers";
import { getResourceClass, createResourcePoolManager } from "@lib/workflow/resource-pools";
import { shouldRetry, RunCircuitBreaker } from "@lib/workflow/retry-classification";

/** Kahn’s topological sort (simple) */
function topo(nodes: GraphNode[], edges: GraphEdge[]): string[] {
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => {
      indeg.set(n.id, 0);
      adj.set(n.id, []);
    });
    edges.forEach((e) => {
      adj.get(e.source)?.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    });

    const q: string[] = [];
    indeg.forEach((d, id) => d === 0 && q.push(id));

    const order: string[] = [];
    while (q.length) {
      const u = q.shift()!;
      order.push(u);
      for (const v of adj.get(u) ?? []) {
        indeg.set(v, (indeg.get(v) ?? 0) - 1);
        if ((indeg.get(v) ?? 0) === 0) q.push(v);
      }
    }
    return order.length === nodes.length ? order : nodes.map((n) => n.id);
  }

import { validateWorkflowTokenLimit, countChatTokens, countEmbeddingTokens, countImageTokens } from "@lib/workflow/token-counting";
import { getTokenLimits } from "@lib/workflow/token-limits";

export type RunMode = "dev" | "marketplace";

export type RunFlowOptions = {
  /** Called whenever a node's execution status changes (for live streaming) */
  onProgress?: (event: FlowProgressEvent) => void;
  /** dev = allow unknown specId passthrough; marketplace = hard-fail on unknown specId */
  runMode?: RunMode;
};

export async function runFlow(
  payload: GraphPayload & { workflowId?: string },
  options?: RunFlowOptions
): Promise<RuntimeResult> {
  const { nodes, edges, inputs = {}, workflowId, requestMetadata } = payload;
  const onProgress = options?.onProgress;
  const runMode: RunMode = options?.runMode ?? "marketplace";

  // Validate graph integrity: filter out edges that reference non-existent nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => {
    const sourceExists = nodeIds.has(e.source);
    const targetExists = nodeIds.has(e.target);
    if (!sourceExists || !targetExists) {
      console.warn(
        `Invalid edge detected: ${e.source} -> ${e.target}. ` +
        `Source exists: ${sourceExists}, Target exists: ${targetExists}. ` +
        `This edge will be ignored.`
      );
      return false;
    }
    return true;
  });

  // If we filtered out edges, log a warning
  if (validEdges.length < edges.length) {
    console.warn(
      `Graph integrity issue: ${edges.length - validEdges.length} invalid edge(s) removed. ` +
      `Original edges: ${edges.length}, Valid edges: ${validEdges.length}`
    );
  }

  // Get configurable token limits
  const tokenLimits = await getTokenLimits(workflowId);

  // Pre-validate workflow token limits (best effort - actual counts may vary)
  // This is a conservative estimate before execution
  let totalEstimatedTokens = 0;
  for (const node of nodes) {
    const specId = node.data?.specId;
    const config = node.data?.config ?? {};

    if (specId === "openai-chat") {
      // Estimate based on config defaults
      const estimatedPrompt = config.prompt || "";
      const tokenCount = countChatTokens({
        prompt: estimatedPrompt,
        system: config.system,
        maxTokens: config.maxTokens || 2000,
      });
      totalEstimatedTokens += tokenCount.total;
    } else if (specId === "openai-embeddings") {
      const estimatedText = config.text || "";
      const tokenCount = countEmbeddingTokens(estimatedText);
      totalEstimatedTokens += tokenCount;
    } else if (specId === "openai-image") {
      const estimatedPrompt = config.prompt || "";
      const tokenCount = countImageTokens(estimatedPrompt);
      totalEstimatedTokens += tokenCount;
    }
  }

  // Only validate if we have OpenAI nodes (to avoid false positives)
  if (totalEstimatedTokens > 0) {
    const workflowTokenValidation = validateWorkflowTokenLimit(
      totalEstimatedTokens,
      tokenLimits.maxTokensPerWorkflow
    );
    if (!workflowTokenValidation.valid) {
      throw new Error(workflowTokenValidation.error || "Workflow token limit exceeded");
    }
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inboundByNode = new Map<string, string[]>();
  const outboundByNode = new Map<string, string[]>();
  const edgesByTarget = new Map<string, Array<{ sourceId: string; edge: GraphEdge }>>();
  nodes.forEach((n) => inboundByNode.set(n.id, []));
  validEdges.forEach((e) => {
    const arr = inboundByNode.get(e.target);
    if (arr) arr.push(e.source);
    const outArr = outboundByNode.get(e.source) ?? [];
    outArr.push(e.target);
    outboundByNode.set(e.source, outArr);
    const targetEdges = edgesByTarget.get(e.target) ?? [];
    targetEdges.push({ sourceId: e.source, edge: e });
    edgesByTarget.set(e.target, targetEdges);
  });

  const state = new ExecutionStateManager({
    nodeIds: nodes.map((n) => n.id),
  });

  state.setWorkflowStatus("running");

  const logs: RunLogEntry[] = [];
  const nodeTraces: NodeTrace[] = [];
  const nodeTraceData = new Map<string, { startMs: number; retries: number }>();
  const blockedNodes: string[] = [];
  const blockedReasons: Record<string, string> = {};

  function recordNodeTrace(
    nodeId: string,
    specId: string,
    status: string,
    endMs: number,
    error?: string,
    retries = 0,
    tokens?: number,
    model?: string
  ): void {
    const data = nodeTraceData.get(nodeId);
    const startMs = data?.startMs ?? endMs;
    nodeTraces.push({
      nodeId,
      specId,
      status,
      startMs,
      endMs,
      error,
      retries: data?.retries ?? retries,
      tokens,
      model,
    });
    nodeTraceData.delete(nodeId);
  }

  function toSourceStatus(s: string): "success" | "failed" {
    return s === "success" ? "success" : "failed";
  }

  /** Condition node: True path runs only when output is true; False path only when false. */
  function satisfiesConditionEdge(
    sourceOutput: unknown,
    sourceStatus: string | undefined,
    sourceHandle: string | undefined
  ): boolean {
    if (sourceStatus !== "success") return false;
    // Condition outputs { __conditionResult, __passthrough } for pipeline passthrough
    let result: boolean;
    if (
      sourceOutput !== null &&
      typeof sourceOutput === "object" &&
      CONDITION_RESULT_KEY in (sourceOutput as Record<string, unknown>)
    ) {
      result = Boolean((sourceOutput as Record<string, unknown>)[CONDITION_RESULT_KEY]);
    } else {
      result = Boolean(sourceOutput);
    }
    if (sourceHandle === "true") return result === true;
    if (sourceHandle === "false") return result === false;
    return true; // no handle: legacy, treat as pass
  }

  function tryMarkReady(
    targetId: string,
    ready: string[],
    indeg: Map<string, number>
  ): void {
    if ((indeg.get(targetId) ?? 0) !== 0) return;
    const targetEdges = edgesByTarget.get(targetId);
    const snapshot = state.getSnapshot();
    if (targetEdges && targetEdges.length > 0) {
      for (const { sourceId, edge } of targetEdges) {
        const sourceOutput = snapshot.outputsByNode[sourceId];
        const sourceStatus = snapshot.nodeStatus[sourceId];
        const sourceNode = nodeById.get(sourceId);
        const sourceSpecId = sourceNode?.data?.specId;

        let satisfied: boolean;
        if (sourceSpecId === "condition") {
          satisfied = satisfiesConditionEdge(sourceOutput, sourceStatus, edge.sourceHandle);
        } else {
          const gating = getEdgeGating(edge) as EdgeGating;
          satisfied = satisfiesEdgeGating(sourceOutput, toSourceStatus(sourceStatus ?? "failed"), gating);
        }

        if (!satisfied) {
          const reason = sourceSpecId === "condition"
            ? `Condition branch not taken (source ${sourceId} ${edge.sourceHandle ?? "?"} -> ${sourceStatus})`
            : `Edge gating not satisfied: source ${sourceId} (${sourceStatus})`;
          blockedNodes.push(targetId);
          blockedReasons[targetId] = reason;
          state.setNodeStatus(targetId, "blocked");
          nodeTraces.push({
            nodeId: targetId,
            specId: nodeById.get(targetId)?.data?.specId ?? "unknown",
            status: "blocked",
            startMs: Date.now(),
            endMs: Date.now(),
            error: reason,
            retries: 0,
          });
          return;
        }
      }
    }
    state.setNodeStatus(targetId, "ready");
    ready.push(targetId);
    const n = nodeById.get(targetId);
    if (onProgress && n) {
      onProgress({
        type: "node_ready",
        nodeId: targetId,
        specId: n.data?.specId ?? "unknown",
        nodeTitle: n.data?.title,
        timestamp: Date.now(),
      });
    }
  }

  const coerceValues = runMode === "marketplace";
  const ctx: RuntimeContext = {
    inputs,
    requestMetadata,
    getInboundValues: (nodeId: string) => {
      const srcs = inboundByNode.get(nodeId) ?? [];
      const snapshot = state.getSnapshot();
      const node = nodeById.get(nodeId);
      const specId = node?.data?.specId ?? "unknown";
      const raw = srcs.map((sid) => {
        const output = snapshot.outputsByNode[sid];
        if (!(sid in snapshot.outputsByNode)) {
          console.warn(`Node ${sid} output not found when ${nodeId} requested it - possible execution order issue`);
        }
        return output;
      });
      if (!coerceValues) return raw;
      return raw.map((v, i) => coerceInbound(specId, i, v));
    },
    setNodeOutput: (nodeId: string, value: unknown) => {
      state.setNodeOutput(nodeId, value);
    },
    setNodeStatus: (nodeId: string, status) => state.setNodeStatus(nodeId, status),
    setWorkflowStatus: (status) => state.setWorkflowStatus(status),
    checkpoint: (partial) => state.checkpoint(partial),
  };

  const order = topo(nodes, validEdges);

  // Pre-mark ready nodes (indegree 0)
  const indeg = new Map<string, number>();
  nodes.forEach((n) => indeg.set(n.id, 0));
  validEdges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1));
  const ready: string[] = [];
  indeg.forEach((d, id) => {
    if (d === 0) {
      tryMarkReady(id, ready, indeg);
    }
  });

  const poolManager = createResourcePoolManager();
  const circuitBreaker = new RunCircuitBreaker(5);

  const runNode = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in graph`);
    }
    const specId = node.data?.specId ?? "unknown";
    const resourceClass = getResourceClass(specId);
    await poolManager.acquire(resourceClass);
    try {
      return await runNodeInner(nodeId, node, specId, circuitBreaker);
    } finally {
      poolManager.release(resourceClass);
    }
  };

  const runNodeInner = async (
    nodeId: string,
    node: GraphNode,
    specId: string,
    circuitBreaker: RunCircuitBreaker
  ) => {
    const nodeTitle = node.data?.title;
    const ts = Date.now();
    nodeTraceData.set(nodeId, { startMs: ts, retries: 0 });

    state.setNodeStatus(nodeId, "running");
    onProgress?.({ type: "node_start", nodeId, specId, nodeTitle, timestamp: ts });
    logs.push({ type: "start", nodeId, specId, timestamp: ts, message: `Starting "${specId}"` });

    const handler: NodeRuntimeHandler | undefined = runtimeRegistry[specId];
    const config = node.data?.config ?? {};
    const timeoutMs = Number(config.timeout ?? 0);
    const hasSideEffects = nodeHasSideEffects(specId, config);
    const retries = hasSideEffects
      ? (typeof config.retries === "number" ? Math.max(0, config.retries) : 0)
      : Math.max(0, Number(config.retries ?? 0));

    const runOnce = async (): Promise<void> => {
      if (!handler) {
        if (runMode === "marketplace") {
          throw new Error(`Unknown specId "${specId}" is not allowed in marketplace runs`);
        }
        const inbound = ctx.getInboundValues(nodeId);
        state.setNodeOutput(nodeId, inbound.length <= 1 ? inbound[0] : inbound);
        return;
      }
      await handler(node, ctx);
    };

    const execWithTimeout = async (): Promise<void> => {
      if (!timeoutMs || Number.isNaN(timeoutMs) || timeoutMs <= 0) {
        return runOnce();
      }
      return Promise.race([
        runOnce(),
        new Promise<void>((_r, rej) => {
          setTimeout(() => rej(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    };

    const failurePolicy = getFailurePolicy(node);

    let attempt = 0;
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await execWithTimeout();
        break;
      } catch (err) {
        if (failurePolicy === "use_fallback_value") {
          const fallback = getFallbackValue(node);
          state.setNodeOutput(nodeId, fallback);
          state.setNodeStatus(nodeId, "success");
          const doneTs = Date.now();
          recordNodeTrace(nodeId, specId, "success", doneTs, undefined, attempt);
          onProgress?.({ type: "node_done", nodeId, specId, nodeTitle: node.data?.title, timestamp: doneTs });
          logs.push({
            type: "success",
            nodeId,
            specId,
            timestamp: doneTs,
            message: `Finished "${specId}" (used fallback after error)`,
          });
          return;
        }
        circuitBreaker.recordFailure();
        attempt += 1;
        nodeTraceData.get(nodeId)!.retries = attempt;
        const decision = shouldRetry(err, attempt, retries, undefined);
        if (!decision.retry || circuitBreaker.isOpen()) {
          throw err;
        }
        logs.push({
          type: "retry",
          nodeId,
          specId,
          timestamp: Date.now(),
          message: `Retrying "${specId}" (attempt ${attempt}/${retries})`,
        });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, decision.delayMs));
      }
    }

    state.setNodeStatus(nodeId, "success");
    const doneTs = Date.now();
    recordNodeTrace(nodeId, specId, "success", doneTs, undefined, attempt);
    onProgress?.({ type: "node_done", nodeId, specId, nodeTitle: node.data?.title, timestamp: doneTs });
    logs.push({
      type: "success",
      nodeId,
      specId,
      timestamp: doneTs,
      message: `Finished "${specId}"`,
    });
  };

  let shouldStop = false;
  while (ready.length > 0 && !shouldStop) {
    const batch = ready.splice(0, ready.length);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      batch.map(async (nodeId) => {
        try {
          await runNode(nodeId);
        } catch (err: any) {
          const failedNode = nodeById.get(nodeId);
          const failedSpecId = failedNode?.data?.specId ?? "unknown";
          const errorMessage = err?.message ?? "Unknown error";
          const policy = getFailurePolicy(failedNode ?? { data: {} });
          const traceData = nodeTraceData.get(nodeId);
          recordNodeTrace(
            nodeId,
            failedSpecId,
            "failed",
            Date.now(),
            errorMessage,
            traceData?.retries ?? 0
          );

          state.setNodeStatus(nodeId, "failed");

          onProgress?.({
            type: "node_failed",
            nodeId,
            specId: failedSpecId,
            nodeTitle: failedNode?.data?.title,
            error: errorMessage,
            timestamp: Date.now(),
          });

          logs.push({
            type: "error",
            nodeId,
            specId: failedSpecId,
            timestamp: Date.now(),
            message: `Failed "${failedSpecId}": ${errorMessage}`,
          });

          if (policy === "fail_fast") {
            state.setWorkflowStatus("failed");
            shouldStop = true;
          }
        } finally {
          const policy = getFailurePolicy(nodeById.get(nodeId) ?? { data: {} });
          const skipDownstream = policy === "skip_downstream" || policy === "fail_fast";
          const downstream = outboundByNode.get(nodeId) ?? [];
          const nodeFailed = state.getSnapshot().nodeStatus[nodeId] === "failed";

          if (!skipDownstream || !nodeFailed) {
            downstream.forEach((v) => {
              indeg.set(v, (indeg.get(v) ?? 0) - 1);
              tryMarkReady(v, ready, indeg);
            });
          }
        }
      })
    );
  }

  const snapshot = state.getSnapshot();

  // Only Output nodes can be "final" for display. Sink nodes like Merge are never shown as workflow output.
  const outputNodes = nodes.filter((n) => n.data?.specId === "output");

  // Processing nodes: produce real output (LLM, API, etc). Input/Merge are passthrough.
  const PROCESSING_SPECS = new Set(["openai-chat", "openai-embeddings", "openai-image", "http-request", "transform"]);
  const hasProcessingUpstream = (nodeId: string, visited = new Set<string>()): boolean => {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    const srcs = inboundByNode.get(nodeId) ?? [];
    for (const sid of srcs) {
      const node = nodeById.get(sid);
      const specId = node?.data?.specId ?? "";
      if (PROCESSING_SPECS.has(specId)) return true;
      if (hasProcessingUpstream(sid, visited)) return true;
    }
    return false;
  };

  // Only include Output nodes that have processing upstream (exclude passthrough: Input/Merge only)
  const meaningfulFinals = outputNodes.filter((n) => hasProcessingUpstream(n.id));

  const hasFailure = Object.values(snapshot.nodeStatus).some((s) => s === "failed" || s === "timeout");
  const hasBlocked = blockedNodes.length > 0;
  if (hasFailure) {
    state.setWorkflowStatus("failed");
  } else if (hasBlocked) {
    state.setWorkflowStatus("completed_with_skips");
  } else {
    state.setWorkflowStatus("completed");
  }

  return {
    outputsByNode: snapshot.outputsByNode,
    finalOutputs: meaningfulFinals.map((n) => ({ nodeId: n.id, value: snapshot.outputsByNode[n.id] })),
    logs,
    nodeStatus: snapshot.nodeStatus,
    workflowStatus: state.getSnapshot().workflowStatus,
    blockedNodes: hasBlocked ? blockedNodes : undefined,
    blockedReasons: hasBlocked ? blockedReasons : undefined,
    nodeTraces,
  };
}
