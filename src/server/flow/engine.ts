import type {
  FlowProgressEvent,
  GraphEdge,
  GraphNode,
  GraphPayload,
  NodeRuntimeHandler,
  RuntimeContext,
  RuntimeResult,
  RunLogEntry,
} from "./types";
import { ExecutionStateManager } from "./execution-state";
import { runtimeRegistry } from "../nodes/handlers";

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

export type RunFlowOptions = {
  /** Called whenever a node's execution status changes (for live streaming) */
  onProgress?: (event: FlowProgressEvent) => void;
};

export async function runFlow(
  payload: GraphPayload & { workflowId?: string },
  options?: RunFlowOptions
): Promise<RuntimeResult> {
  const { nodes, edges, inputs = {}, workflowId, requestMetadata } = payload;
  const onProgress = options?.onProgress;

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
  nodes.forEach((n) => inboundByNode.set(n.id, []));
  validEdges.forEach((e) => {
    const arr = inboundByNode.get(e.target);
    if (arr) arr.push(e.source);
    const outArr = outboundByNode.get(e.source) ?? [];
    outArr.push(e.target);
    outboundByNode.set(e.source, outArr);
  });

  const state = new ExecutionStateManager({
    nodeIds: nodes.map((n) => n.id),
  });

  state.setWorkflowStatus("running");

  const logs: RunLogEntry[] = [];

  const ctx: RuntimeContext = {
    inputs,
    requestMetadata,
    getInboundValues: (nodeId: string) => {
      const srcs = inboundByNode.get(nodeId) ?? [];
      const snapshot = state.getSnapshot();
      // Map source node IDs to their outputs
      // Note: outputsByNode may not have the key if node hasn't executed, but topological sort ensures order
      return srcs.map((sid) => {
        const output = snapshot.outputsByNode[sid];
        // If output is explicitly undefined (key doesn't exist), that's an error - node should have executed
        if (!(sid in snapshot.outputsByNode)) {
          console.warn(`Node ${sid} output not found when ${nodeId} requested it - possible execution order issue`);
        }
        return output;
      });
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
      state.setNodeStatus(id, "ready");
      ready.push(id);
      const n = nodeById.get(id);
      if (onProgress && n) {
        onProgress({
          type: "node_ready",
          nodeId: id,
          specId: n.data?.specId ?? "unknown",
          nodeTitle: n.data?.title,
          timestamp: Date.now(),
        });
      }
    }
  });

  const CONCURRENCY = 4;

  const runNode = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in graph`);
    }
    const specId = node.data?.specId ?? "unknown";
    const nodeTitle = node.data?.title;
    const ts = Date.now();

    state.setNodeStatus(nodeId, "running");
    onProgress?.({ type: "node_start", nodeId, specId, nodeTitle, timestamp: ts });
    logs.push({ type: "start", nodeId, specId, timestamp: ts, message: `Starting "${specId}"` });

    const handler: NodeRuntimeHandler | undefined = runtimeRegistry[specId];
    const timeoutMs = Number(node.data?.config?.timeout ?? 0);
    const retries = Math.max(0, Number(node.data?.config?.retries ?? 0));

    const runOnce = async () => {
      if (!handler) {
        const inbound = ctx.getInboundValues(nodeId);
        state.setNodeOutput(nodeId, inbound.length <= 1 ? inbound[0] : inbound);
        return;
      }
      await handler(node, ctx);
    };

    const execWithTimeout = async () => {
      if (!timeoutMs || Number.isNaN(timeoutMs) || timeoutMs <= 0) {
        return runOnce();
      }
      return Promise.race([
        runOnce(),
        new Promise((_r, rej) => {
          setTimeout(() => rej(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    };

    let attempt = 0;
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await execWithTimeout();
        break;
      } catch (err) {
        attempt += 1;
        if (attempt > retries) {
          throw err;
        }
        logs.push({
          type: "retry",
          nodeId,
          specId,
          timestamp: Date.now(),
          message: `Retrying "${specId}" (attempt ${attempt}/${retries})`,
        });
        // Exponential backoff: 250ms, 500ms, 1000ms, 2000ms max
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, Math.min(2000, 250 * 2 ** (attempt - 1))));
      }
    }

    state.setNodeStatus(nodeId, "success");
    const doneTs = Date.now();
    onProgress?.({ type: "node_done", nodeId, specId, nodeTitle: node.data?.title, timestamp: doneTs });
    logs.push({
      type: "success",
      nodeId,
      specId,
      timestamp: doneTs,
      message: `Finished "${specId}"`,
    });
  };

  while (ready.length > 0) {
    const batch = ready.splice(0, CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      batch.map(async (nodeId) => {
        try {
          await runNode(nodeId);
        } catch (err: any) {
          // Set node to failed state (now allowed from ready state)
          state.setNodeStatus(nodeId, "failed");

          // Safely get node info for logging
          const failedNode = nodeById.get(nodeId);
          const failedSpecId = failedNode?.data?.specId ?? "unknown";
          const errorMessage = err?.message ?? "Unknown error";

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
        } finally {
          const downstream = outboundByNode.get(nodeId) ?? [];
          downstream.forEach((v) => {
            indeg.set(v, (indeg.get(v) ?? 0) - 1);
            if ((indeg.get(v) ?? 0) === 0) {
              state.setNodeStatus(v, "ready");
              ready.push(v);
              const n = nodeById.get(v);
              if (onProgress && n) {
                onProgress({
                  type: "node_ready",
                  nodeId: v,
                  specId: n.data?.specId ?? "unknown",
                  nodeTitle: n.data?.title,
                  timestamp: Date.now(),
                });
              }
            }
          });
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
  state.setWorkflowStatus(hasFailure ? "failed" : "completed");

  return {
    outputsByNode: snapshot.outputsByNode,
    finalOutputs: meaningfulFinals.map((n) => ({ nodeId: n.id, value: snapshot.outputsByNode[n.id] })),
    logs,
    nodeStatus: snapshot.nodeStatus,
    workflowStatus: snapshot.workflowStatus,
  };
}
