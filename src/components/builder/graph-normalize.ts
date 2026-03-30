import type { Edge, Node } from "reactflow";
import { getNodeSpec } from "src/nodes/registry";
import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";

function safeParseGraph(input: any): any {
  if (input == null) return null;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input;
}

/** Legacy per-provider chat nodes → unified LLM Chat (config.model preserved). */
function migrateLegacyChatSpecId(node: Node<any>): Node<any> {
  const sid = node?.data?.specId;
  if (sid !== "claude-chat" && sid !== "gemini-chat") return node;
  return {
    ...node,
    data: {
      ...node.data,
      specId: "llm-chat",
    },
  };
}

function normalizeNodeType(node: Node<any>): Node<any> {
  const migrated = migrateLegacyChatSpecId(node);
  const specId = migrated?.data?.specId;
  if (!specId) return migrated;
  const spec = getNodeSpec(specId);
  if (!spec) return migrated;

  const desiredType = spec.nodeType ?? "edgCard";
  const currentType = typeof node.type === "string" ? node.type : "";
  const shouldUpgrade = !currentType || (currentType === "edgCard" && desiredType !== "edgCard");

  return shouldUpgrade ? { ...migrated, type: desiredType } : migrated;
}

function hasPort(specId: string | undefined, kind: "input" | "output", portId: string): boolean {
  if (!specId) return false;
  const spec = getNodeSpec(specId);
  if (!spec) return false;
  return spec.ports.some((p) => p.kind === kind && p.id === portId);
}

function migrateHandle(
  handle: string | null | undefined,
  kind: "source" | "target",
  specId: string | undefined,
): string | null | undefined {
  if (handle == null || handle === "") return handle;

  const canonical = canonicalSpecId(specId ?? "");

  if (kind === "target" && canonical === "merge") {
    if (handle === "in-left") return "in-1";
    if (handle === "in-top") return "in-2";
    if (handle === "in-bottom") return "in-3";
  }
  if (kind === "source" && canonical === "merge" && handle === "out-right") {
    return "out";
  }

  // Common legacy alias from older templates/data. Resolve to whichever valid
  // port exists on this node spec.
  if (handle === "data") {
    if (kind === "source") {
      if (hasPort(specId, "output", "out-right")) return "out-right";
      if (hasPort(specId, "output", "out")) return "out";
      if (hasPort(specId, "output", "output")) return "output";
    } else {
      if (hasPort(specId, "input", "in-left")) return "in-left";
      if (hasPort(specId, "input", "in")) return "in";
      if (hasPort(specId, "input", "input")) return "input";
    }
  }

  return handle;
}

export function normalizeGraph<TNodeData = any>(
  graphLike: any,
): { nodes: Node<TNodeData>[]; edges: Edge[] } {
  const g0 = safeParseGraph(graphLike);
  const g =
    g0?.graph && (Array.isArray(g0.graph.nodes) || Array.isArray(g0.graph.edges)) ? g0.graph : g0;

  const rawNodes = Array.isArray(g?.nodes) ? (g.nodes as Node<TNodeData>[]) : [];
  const nodes = rawNodes.map((node) => {
    const normalizedId =
      node?.id != null && typeof node.id !== "string" ? String(node.id) : (node?.id as string);
    const withId = normalizedId !== node?.id ? ({ ...node, id: normalizedId } as Node<TNodeData>) : node;
    return normalizeNodeType(withId as Node<any>) as Node<TNodeData>;
  });

  const nodesById = new Map(nodes.map((n) => [String(n.id), n]));

  // Support both "edges" and "connections" (legacy alias)
  const rawEdges = Array.isArray(g?.edges)
    ? (g.edges as Edge[])
    : Array.isArray(g?.connections)
      ? (g.connections as Edge[])
      : [];

  const edges = rawEdges
    .map((e: any) => {
      const src = e?.source ?? e?.sourceId ?? e?.sourceNode?.id ?? e?.sourceNode;
      const tgt = e?.target ?? e?.targetId ?? e?.targetNode?.id ?? e?.targetNode;
      const srcId =
        src != null ? (typeof src === "string" ? src : ((src as any)?.id ?? String(src))) : null;
      const tgtId =
        tgt != null ? (typeof tgt === "string" ? tgt : ((tgt as any)?.id ?? String(tgt))) : null;
      if (srcId == null || tgtId == null) return null;

      const srcNode = nodesById.get(String(srcId)) as Node<any> | undefined;
      const tgtNode = nodesById.get(String(tgtId)) as Node<any> | undefined;
      const sourceHandle = migrateHandle(e?.sourceHandle, "source", srcNode?.data?.specId);
      const targetHandle = migrateHandle(e?.targetHandle, "target", tgtNode?.data?.specId);
      const sh = sourceHandle ?? "";
      const th = targetHandle ?? "";
      const suffix = sh || th ? `-${sh}-${th}` : "";

      return {
        ...e,
        id: e?.id ?? `e-${String(srcId)}-${String(tgtId)}${suffix}`,
        source: String(srcId),
        target: String(tgtId),
        sourceHandle,
        targetHandle,
      } as Edge;
    })
    .filter((e): e is Edge => e != null);

  return { nodes, edges };
}
