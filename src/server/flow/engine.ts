import type {
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
  
export async function runFlow(payload: GraphPayload): Promise<RuntimeResult> {
  const { nodes, edges, inputs = {} } = payload;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inboundByNode = new Map<string, string[]>();
  const outboundByNode = new Map<string, string[]>();
  nodes.forEach((n) => inboundByNode.set(n.id, []));
  edges.forEach((e) => {
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
    getInboundValues: (nodeId: string) => {
      const srcs = inboundByNode.get(nodeId) ?? [];
      const snapshot = state.getSnapshot();
      return srcs.map((sid) => snapshot.outputsByNode[sid]);
    },
    setNodeOutput: (nodeId: string, value: unknown) => {
      state.setNodeOutput(nodeId, value);
    },
    setNodeStatus: (nodeId: string, status) => state.setNodeStatus(nodeId, status),
    setWorkflowStatus: (status) => state.setWorkflowStatus(status),
    checkpoint: (partial) => state.checkpoint(partial),
  };

  const order = topo(nodes, edges);

  // Pre-mark ready nodes (indegree 0)
  const indeg = new Map<string, number>();
  nodes.forEach((n) => indeg.set(n.id, 0));
  edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1));
  const ready: string[] = [];
  indeg.forEach((d, id) => {
    if (d === 0) {
      state.setNodeStatus(id, "ready");
      ready.push(id);
    }
  });

  const CONCURRENCY = 4;

  const runNode = async (nodeId: string) => {
    const node = nodeById.get(nodeId)!;
    const specId = node.data?.specId;
    const ts = Date.now();

    state.setNodeStatus(nodeId, "running");
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
        state.setNodeStatus(nodeId, "retrying");
      }
    }

    state.setNodeStatus(nodeId, "success");
    logs.push({
      type: "success",
      nodeId,
      specId,
      timestamp: Date.now(),
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
          state.setNodeStatus(nodeId, "failed");
          logs.push({
            type: "error",
            nodeId,
            specId: nodeById.get(nodeId)?.data?.specId ?? "unknown",
            timestamp: Date.now(),
            message: `Failed "${nodeById.get(nodeId)?.data?.specId}": ${err?.message ?? "Unknown error"}`,
          });
        } finally {
          const downstream = outboundByNode.get(nodeId) ?? [];
          downstream.forEach((v) => {
            indeg.set(v, (indeg.get(v) ?? 0) - 1);
            if ((indeg.get(v) ?? 0) === 0) {
              state.setNodeStatus(v, "ready");
              ready.push(v);
            }
          });
        }
      })
    );
  }

  const nodesWithOutgoing = new Set(edges.map((e) => e.source));
  const finals = nodes.filter((n) => !nodesWithOutgoing.has(n.id) || n.data?.specId === "output");
  const snapshot = state.getSnapshot();

  const hasFailure = Object.values(snapshot.nodeStatus).some((s) => s === "failed" || s === "timeout");
  state.setWorkflowStatus(hasFailure ? "failed" : "completed");

  return {
    outputsByNode: snapshot.outputsByNode,
    finalOutputs: finals.map((n) => ({ nodeId: n.id, value: snapshot.outputsByNode[n.id] })),
    logs,
    nodeStatus: snapshot.nodeStatus,
    workflowStatus: snapshot.workflowStatus,
  };
}
