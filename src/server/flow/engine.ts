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
import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";

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
  if (order.length !== nodes.length) {
    const cycleNodes = nodes.filter((n) => !order.includes(n.id)).map((n) => n.id);
    throw new Error(
      `Workflow contains a cycle involving node(s): ${cycleNodes.join(", ")}. ` +
        `Please remove circular connections and try again.`,
    );
  }

  return order;
}

import {
  validateWorkflowTokenLimit,
  countChatTokens,
  countEmbeddingTokens,
  countImageTokens,
} from "@lib/workflow/token-counting";
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
  options?: RunFlowOptions,
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
          `This edge will be ignored.`,
      );
      return false;
    }
    return true;
  });

  // If we filtered out edges, log a warning
  if (validEdges.length < edges.length) {
    console.warn(
      `Graph integrity issue: ${edges.length - validEdges.length} invalid edge(s) removed. ` +
        `Original edges: ${edges.length}, Valid edges: ${validEdges.length}`,
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

    const canonical = canonicalSpecId(specId);
    if (canonical === "llm-chat") {
      const estimatedPrompt = config.prompt || "";
      const tokenCount = countChatTokens({
        prompt: estimatedPrompt,
        system: config.system,
        maxTokens: config.maxTokens || 2000,
      });
      totalEstimatedTokens += tokenCount.total;
    } else if (canonical === "llm-embeddings") {
      const estimatedText = config.text || "";
      const tokenCount = countEmbeddingTokens(estimatedText);
      totalEstimatedTokens += tokenCount;
    } else if (canonical === "llm-image") {
      const estimatedPrompt = config.prompt || "";
      const tokenCount = countImageTokens(estimatedPrompt);
      totalEstimatedTokens += tokenCount;
    }
  }

  // Only validate if we have OpenAI nodes (to avoid false positives)
  if (totalEstimatedTokens > 0) {
    const workflowTokenValidation = validateWorkflowTokenLimit(
      totalEstimatedTokens,
      tokenLimits.maxTokensPerWorkflow,
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
    model?: string,
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
    sourceHandle: string | undefined,
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

  function tryMarkReady(targetId: string, ready: string[], indeg: Map<string, number>): void {
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
          satisfied = satisfiesEdgeGating(
            sourceOutput,
            toSourceStatus(sourceStatus ?? "failed"),
            gating,
          );
        }

        if (!satisfied) {
          const reason =
            sourceSpecId === "condition"
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
          console.warn(
            `Node ${sid} output not found when ${nodeId} requested it - possible execution order issue`,
          );
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
  const runBreaker = new RunCircuitBreaker(8); // Global safety: stop entire run after 8 total failures
  const nodeBreakers = new Map<string, RunCircuitBreaker>(); // Per-node: stop retrying one node after 3 failures

  const getNodeBreaker = (nodeId: string): RunCircuitBreaker => {
    let breaker = nodeBreakers.get(nodeId);
    if (!breaker) {
      breaker = new RunCircuitBreaker(3);
      nodeBreakers.set(nodeId, breaker);
    }
    return breaker;
  };

  const runNode = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in graph`);
    }
    const specId = node.data?.specId ?? "unknown";
    const resourceClass = getResourceClass(specId);
    await poolManager.acquire(resourceClass);
    try {
      return await runNodeInner(nodeId, node, specId, getNodeBreaker(nodeId), runBreaker);
    } finally {
      poolManager.release(resourceClass);
    }
  };

  const runNodeInner = async (
    nodeId: string,
    node: GraphNode,
    specId: string,
    nodeBreaker: RunCircuitBreaker,
    runBreaker: RunCircuitBreaker,
  ) => {
    const nodeTitle = node.data?.title;
    const ts = Date.now();
    nodeTraceData.set(nodeId, { startMs: ts, retries: 0 });

    state.setNodeStatus(nodeId, "running");
    onProgress?.({ type: "node_start", nodeId, specId, nodeTitle, timestamp: ts });
    logs.push({ type: "start", nodeId, specId, timestamp: ts, message: `Starting "${specId}"` });

    const handler: NodeRuntimeHandler | undefined =
      runtimeRegistry[specId] ?? runtimeRegistry[canonicalSpecId(specId)];
    const config = node.data?.config ?? {};
    const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes — no node should run unbounded
    const configTimeout = Number(config.timeout ?? 0);
    let timeoutMs =
      configTimeout > 0 && !Number.isNaN(configTimeout) ? configTimeout : DEFAULT_TIMEOUT_MS;
    const canonicalForTimeout = canonicalSpecId(specId);
    const isLlmChatLike = canonicalForTimeout === "llm-chat";
    // Legacy OpenAI Chat stored 30s; unified LLM calls routinely exceed that.
    if (isLlmChatLike && timeoutMs < DEFAULT_TIMEOUT_MS) {
      timeoutMs = DEFAULT_TIMEOUT_MS;
    }
    const hasSideEffects = nodeHasSideEffects(specId, config);
    const retries = hasSideEffects
      ? typeof config.retries === "number"
        ? Math.max(0, config.retries)
        : 0
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          runOnce(),
          new Promise<never>((_r, rej) => {
            timer = setTimeout(
              () => rej(new Error(`Node "${specId}" timed out after ${timeoutMs}ms`)),
              timeoutMs,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    };

    const failurePolicy = getFailurePolicy(node);

    let attempt = 0;
    while (true) {
      try {
        await execWithTimeout();
        break;
      } catch (err) {
        if (failurePolicy === "use_fallback_value") {
          const fallback = getFallbackValue(node);
          state.setNodeOutput(nodeId, fallback);
          state.setNodeStatus(nodeId, "success");
          const doneTs = Date.now();
          recordNodeTrace(nodeId, specId, "success", doneTs, undefined, attempt);
          onProgress?.({
            type: "node_done",
            nodeId,
            specId,
            nodeTitle: node.data?.title,
            timestamp: doneTs,
          });
          logs.push({
            type: "success",
            nodeId,
            specId,
            timestamp: doneTs,
            message: `Finished "${specId}" (used fallback after error)`,
          });
          return;
        }
        nodeBreaker.recordFailure();
        runBreaker.recordFailure();
        attempt += 1;
        nodeTraceData.get(nodeId)!.retries = attempt;
        const decision = shouldRetry(err, attempt, retries, undefined);
        if (!decision.retry || nodeBreaker.isOpen() || runBreaker.isOpen()) {
          throw err;
        }
        logs.push({
          type: "retry",
          nodeId,
          specId,
          timestamp: Date.now(),
          message: `Retrying "${specId}" (attempt ${attempt}/${retries})`,
        });

        await new Promise((r) => setTimeout(r, decision.delayMs));
      }
    }

    // Record success: reduce circuit breaker pressure
    nodeBreaker.recordSuccess();
    runBreaker.recordSuccess();

    state.setNodeStatus(nodeId, "success");
    const doneTs = Date.now();
    recordNodeTrace(nodeId, specId, "success", doneTs, undefined, attempt);
    onProgress?.({
      type: "node_done",
      nodeId,
      specId,
      nodeTitle: node.data?.title,
      timestamp: doneTs,
    });
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

    await Promise.allSettled(
      batch.map(async (nodeId) => {
        if (shouldStop) return;

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
            traceData?.retries ?? 0,
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
          const node = nodeById.get(nodeId);
          const policy = getFailurePolicy(node ?? { data: {} });
          const downstream = outboundByNode.get(nodeId) ?? [];
          const nodeFailed = state.getSnapshot().nodeStatus[nodeId] === "failed";

          // Only block downstream propagation for explicit skip/fail policies on failure
          // "continue" policy MUST propagate to downstream even on failure
          const blockDownstream =
            nodeFailed && (policy === "skip_downstream" || policy === "fail_fast");

          if (!blockDownstream) {
            downstream.forEach((v) => {
              indeg.set(v, (indeg.get(v) ?? 0) - 1);
              tryMarkReady(v, ready, indeg);
            });
          } else if (nodeFailed && policy === "skip_downstream") {
            // Mark all downstream as skipped so they don't hang as "idle"
            const markSkipped = (nid: string, visited = new Set<string>()) => {
              if (visited.has(nid)) return;
              visited.add(nid);
              state.setNodeStatus(nid, "skipped");
              for (const child of outboundByNode.get(nid) ?? []) {
                markSkipped(child, visited);
              }
            };
            downstream.forEach((v) => markSkipped(v));
          }
        }
      }),
    );
  }

  const snapshot = state.getSnapshot();

  // Detect stuck nodes: any node still "idle" or "ready" after execution loop means
  // the dependency graph had an issue (should have been caught by cycle detection,
  // but this is a safety net)
  const stuckNodes = Object.entries(snapshot.nodeStatus).filter(
    ([, s]) => s === "idle" || s === "ready",
  );
  if (stuckNodes.length > 0) {
    for (const [stuckId] of stuckNodes) {
      state.setNodeStatus(stuckId, "skipped");
      const stuckNode = nodeById.get(stuckId);
      logs.push({
        type: "warn",
        nodeId: stuckId,
        specId: stuckNode?.data?.specId ?? "unknown",
        timestamp: Date.now(),
        message: `Node "${stuckNode?.data?.specId ?? stuckId}" was never reached — likely blocked by an upstream failure or condition.`,
      });
    }
  }

  // Only Output nodes can be "final" for display. Sink nodes like Merge are never shown as workflow output.
  const outputNodes = nodes.filter((n) => n.data?.specId === "output");

  const PROCESSING_SPECS = new Set([
    "llm-chat",
    "llm-embeddings",
    "llm-image",
    "openai-chat",
    "openai-embeddings",
    "openai-image",
    "http-request",
    "transform",
  ]);
  const hasProcessingUpstream = (nodeId: string, visited = new Set<string>()): boolean => {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    const srcs = inboundByNode.get(nodeId) ?? [];
    for (const sid of srcs) {
      const node = nodeById.get(sid);
      const specId = node?.data?.specId ?? "";
      if (PROCESSING_SPECS.has(specId) || PROCESSING_SPECS.has(canonicalSpecId(specId)))
        return true;
      if (hasProcessingUpstream(sid, visited)) return true;
    }
    return false;
  };

  const meaningfulFinals = outputNodes.filter((n) => hasProcessingUpstream(n.id));

  const finalSnapshot = state.getSnapshot();
  const hasFailure = Object.values(finalSnapshot.nodeStatus).some(
    (s) => s === "failed" || s === "timeout",
  );
  const hasBlocked = blockedNodes.length > 0 || stuckNodes.length > 0;
  if (hasFailure) {
    state.setWorkflowStatus("failed");
  } else if (hasBlocked) {
    state.setWorkflowStatus("completed_with_skips");
  } else {
    state.setWorkflowStatus("completed");
  }

  return {
    outputsByNode: finalSnapshot.outputsByNode,
    finalOutputs: meaningfulFinals.map((n) => ({
      nodeId: n.id,
      value: finalSnapshot.outputsByNode[n.id],
    })),
    logs,
    nodeStatus: state.getSnapshot().nodeStatus,
    workflowStatus: state.getSnapshot().workflowStatus,
    blockedNodes: hasBlocked ? blockedNodes : undefined,
    blockedReasons: hasBlocked ? blockedReasons : undefined,
    nodeTraces,
  };
}
