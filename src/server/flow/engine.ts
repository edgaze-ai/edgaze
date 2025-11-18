import type {
    GraphEdge,
    GraphNode,
    GraphPayload,
    NodeRuntimeHandler,
    RuntimeContext,
    RuntimeResult,
    RunLogEntry,
  } from "./types";
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
    nodes.forEach((n) => inboundByNode.set(n.id, []));
    edges.forEach((e) => {
      const arr = inboundByNode.get(e.target);
      if (arr) arr.push(e.source);
    });
  
    const outputsByNode: Record<string, unknown> = {};
    const logs: RunLogEntry[] = [];
    const nodeStatus: Record<string, "idle" | "running" | "success" | "error"> = {};
    nodes.forEach((n) => (nodeStatus[n.id] = "idle"));
  
    const ctx: RuntimeContext = {
      inputs,
      getInboundValues: (nodeId: string) => {
        const srcs = inboundByNode.get(nodeId) ?? [];
        return srcs.map((sid) => outputsByNode[sid]);
      },
      setNodeOutput: (nodeId: string, value: unknown) => {
        outputsByNode[nodeId] = value;
      },
    };
  
    const order = topo(nodes, edges);
  
    for (const nodeId of order) {
      const node = nodeById.get(nodeId)!;
      const specId = node.data?.specId;
      const ts = Date.now();
  
      nodeStatus[nodeId] = "running";
      logs.push({ type: "start", nodeId, specId, timestamp: ts, message: `Starting "${specId}"` });
  
      try {
        const handler: NodeRuntimeHandler | undefined = runtimeRegistry[specId];
        if (!handler) {
          const inbound = ctx.getInboundValues(nodeId);
          outputsByNode[nodeId] = inbound.length <= 1 ? inbound[0] : inbound;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await handler(node, ctx);
        }
        nodeStatus[nodeId] = "success";
        logs.push({
          type: "success",
          nodeId,
          specId,
          timestamp: Date.now(),
          message: `Finished "${specId}"`,
        });
      } catch (err: any) {
        nodeStatus[nodeId] = "error";
        logs.push({
          type: "error",
          nodeId,
          specId,
          timestamp: Date.now(),
          message: `Failed "${specId}": ${err?.message ?? "Unknown error"}`,
        });
        // Continue running remaining nodes; downstream will just receive undefined.
      }
    }
  
    const nodesWithOutgoing = new Set(edges.map((e) => e.source));
    const finals = nodes.filter((n) => !nodesWithOutgoing.has(n.id) || n.data?.specId === "output");
  
    return {
      outputsByNode,
      finalOutputs: finals.map((n) => ({ nodeId: n.id, value: outputsByNode[n.id] })),
      logs,
      nodeStatus,
    };
  }
  