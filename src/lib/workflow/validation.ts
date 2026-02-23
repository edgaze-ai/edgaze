// src/lib/workflow/validation.ts
/**
 * Validates workflow graphs for potential issues that could cause high costs or errors
 */

export type GraphNode = {
  id: string;
  data?: {
    specId?: string;
    title?: string;
    config?: any;
  };
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type ValidationIssue = {
  message: string;
  nodeId?: string;
  /** Inspector field key to highlight, e.g. "prompt", "url", "model", "connection" */
  fieldHint?: string;
  /** Explicit guidance: where to go and what to do, e.g. "Inspector → Configuration → Prompt" */
  fixGuidance?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

/** Shorthand to create a ValidationIssue */
function issue(
  msg: string,
  nodeId?: string,
  fieldHint?: string,
  fixGuidance?: string
): ValidationIssue {
  return { message: msg, nodeId, fieldHint, fixGuidance };
}

const EXPENSIVE_NODE_TYPES = [
  "openai-chat",
  "openai-embeddings",
  "openai-image",
  "http-request",
  "anthropic-chat",
  "google-ai",
];

/** DALL-E 2 does not support "quality" (API returns unknown parameter). Only DALL-E 3 supports "standard" | "hd". */
const DALL_E_2_SIZES = ["256x256", "512x512", "1024x1024"];
const DALL_E_3_SIZES = ["1024x1024", "1792x1024", "1024x1792"];

function validateOpenAIImageNode(node: GraphNode): ValidationIssue[] {
  const config = node.data?.config ?? {};
  const model = config.model || "dall-e-2";
  const quality = config.quality || "standard";
  const size = config.size || "1024x1024";
  const name = config.name || node.data?.specId || "OpenAI Image";
  const errs: ValidationIssue[] = [];
  if (model === "dall-e-2" && quality === "hd") {
    errs.push(issue(
      `${name}: Quality "HD" is only supported with DALL-E 3.`,
      node.id, "quality", "Inspector → Configuration → Model: set to DALL-E 3, or Quality: set to Standard"
    ));
  }
  if (model === "dall-e-2" && !DALL_E_2_SIZES.includes(size)) {
    errs.push(issue(
      `${name}: Size "${size}" is not valid for DALL-E 2.`,
      node.id, "size", "Inspector → Configuration → Size: use 256x256, 512x512, or 1024x1024"
    ));
  }
  if (model === "dall-e-3" && !DALL_E_3_SIZES.includes(size)) {
    errs.push(issue(
      `${name}: Size "${size}" is not valid for DALL-E 3.`,
      node.id, "size", "Inspector → Configuration → Size: use 1024x1024, 1792x1024, or 1024x1792"
    ));
  }
  return errs;
}

const MAX_NODES = 50;
const MAX_EXPENSIVE_NODES = 10;
const MAX_DEPTH = 20;

/**
 * Detect cycles in a directed graph using DFS
 */
function hasCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    const neighbors = adj.get(e.source) || [];
    neighbors.push(e.target);
    adj.set(e.source, neighbors);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (recStack.has(nodeId)) return true; // Cycle detected
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Calculate maximum depth of the workflow
 */
function calculateMaxDepth(nodes: GraphNode[], edges: GraphEdge[]): number {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    const neighbors = adj.get(e.source) || [];
    neighbors.push(e.target);
    adj.set(e.source, neighbors);
  });

  // Find nodes with no incoming edges (entry points)
  const hasIncoming = new Set<string>();
  edges.forEach((e) => hasIncoming.add(e.target));
  const entryPoints = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);

  if (entryPoints.length === 0) return 0;

  const visited = new Map<string, number>();

  const dfs = (nodeId: string, depth: number): number => {
    if (visited.has(nodeId)) {
      return Math.max(visited.get(nodeId)!, depth);
    }

    visited.set(nodeId, depth);
    const neighbors = adj.get(nodeId) || [];
    let maxDepth = depth;

    for (const neighbor of neighbors) {
      maxDepth = Math.max(maxDepth, dfs(neighbor, depth + 1));
    }

    return maxDepth;
  };

  let maxDepth = 0;
  for (const entry of entryPoints) {
    maxDepth = Math.max(maxDepth, dfs(entry, 1));
  }

  return maxDepth;
}

/**
 * Validate workflow graph for potential issues
 */
export function validateWorkflowGraph(
  nodes: GraphNode[],
  edges: GraphEdge[]
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check for empty workflow
  if (nodes.length === 0) {
    errors.push(issue("Workflow must contain at least one node"));
    return { valid: false, errors, warnings };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inboundByNode = new Map<string, string[]>();
  nodes.forEach((n) => inboundByNode.set(n.id, []));
  edges.forEach((e) => {
    const arr = inboundByNode.get(e.target) ?? [];
    arr.push(e.source);
    inboundByNode.set(e.target, arr);
  });

  // Check for invalid edges (reference non-existent nodes) — one issue per edge
  const invalidEdges = edges.filter(
    (e) => !nodeIds.has(e.source) || !nodeIds.has(e.target)
  );
  for (const e of invalidEdges) {
    const srcExists = nodeIds.has(e.source);
    const tgtExists = nodeIds.has(e.target);
    const focusNodeId = srcExists ? e.source : tgtExists ? e.target : undefined;
    const msg = srcExists || tgtExists
      ? `Connection ${srcExists ? `from this node to missing "${e.target}"` : `from missing "${e.source}" to this node`}.`
      : `Orphan connection references missing nodes.`;
    errors.push(issue(
      msg,
      focusNodeId,
      "connection",
      focusNodeId
        ? "Canvas: select this node, then delete the invalid connection (or add the missing node)"
        : "Canvas: find and delete the orphan connection"
    ));
  }

  // OpenAI Chat: needs prompt or inbound connection
  for (const node of nodes) {
    if (node.data?.specId === "openai-chat") {
      const config = node.data?.config ?? {};
      const hasPrompt = typeof config.prompt === "string" && config.prompt.trim().length > 0;
      const hasInbound = (inboundByNode.get(node.id) ?? []).length > 0;
      const title = node.data?.title ?? config.name ?? "OpenAI Chat";
      if (!hasPrompt && !hasInbound) {
        errors.push(issue(
          `"${title}": Missing prompt. Add one or connect an Input node.`,
          node.id, "prompt", "Inspector → Configuration → Prompt: enter text or connect an Input"
        ));
      }
    }
  }

  // HTTP Request: URL required
  for (const node of nodes) {
    if (node.data?.specId === "http-request") {
      const config = node.data?.config ?? {};
      const url = config.url ?? config.URL ?? "";
      const hasUrl = typeof url === "string" && url.trim().length > 0;
      const title = node.data?.title ?? config.name ?? "HTTP Request";
      if (!hasUrl) {
        errors.push(issue(
          `"${title}": URL is required.`,
          node.id, "url", "Inspector → Configuration → URL: enter the request URL"
        ));
      }
    }
  }

  // OpenAI Embeddings: needs text or inbound
  for (const node of nodes) {
    if (node.data?.specId === "openai-embeddings") {
      const config = node.data?.config ?? {};
      const hasText = typeof config.text === "string" && config.text.trim().length > 0;
      const hasInbound = (inboundByNode.get(node.id) ?? []).length > 0;
      const title = node.data?.title ?? config.name ?? "OpenAI Embeddings";
      if (!hasText && !hasInbound) {
        errors.push(issue(
          `"${title}": Missing text. Add text or connect an Input node.`,
          node.id, "text", "Inspector → Configuration → Text: enter text or connect an Input"
        ));
      }
    }
  }

  // Input nodes: recommend a label for better UX (warning only) — one per node
  for (const node of nodes) {
    if (node.data?.specId === "input") {
      const config = node.data?.config ?? {};
      const hasLabel = (config.label ?? config.inputKey ?? config.question ?? config.name ?? "").toString().trim().length > 0;
      if (!hasLabel) {
        warnings.push(issue(
          "Input node has no label. Users won't know what to enter.",
          node.id, "question", "Inspector → General → Question / Input Name: add a label"
        ));
      }
    }
  }

  // Check for cycles
  if (hasCycle(nodes, edges)) {
    errors.push(issue(
      "Workflow has a circular dependency.",
      undefined, undefined, "Canvas: find and remove the connection that creates the loop"
    ));
  }

  // Check node count
  if (nodes.length > MAX_NODES) {
    errors.push(issue(
      `Workflow has ${nodes.length} nodes (max ${MAX_NODES}).`,
      undefined, undefined, "Simplify: remove or merge nodes"
    ));
  }

  // Validate OpenAI Image node config
  for (const node of nodes) {
    if (node.data?.specId === "openai-image") {
      errors.push(...validateOpenAIImageNode(node));
    }
  }

  // Check for expensive nodes
  const expensiveNodes = nodes.filter(
    (n) => EXPENSIVE_NODE_TYPES.includes(n.data?.specId || "")
  );

  if (expensiveNodes.length > MAX_EXPENSIVE_NODES) {
    warnings.push(issue(
      `Workflow has ${expensiveNodes.length} external service nodes. Each execution consumes credits.`
    ));
  }

  // Check workflow depth
  const maxDepth = calculateMaxDepth(nodes, edges);
  if (maxDepth > MAX_DEPTH) {
    warnings.push(issue(
      `Workflow depth is ${maxDepth} levels. Consider flattening.`
    ));
  }

  // Check for disconnected nodes
  const connectedNodes = new Set<string>();
  edges.forEach((e) => {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  });

  // Disconnected nodes — one warning per node
  const disconnectedNodes = nodes.filter((n) => !connectedNodes.has(n.id));
  if (nodes.length > 1) {
    for (const node of disconnectedNodes) {
      const title = node.data?.title ?? node.data?.config?.name ?? "Node";
      warnings.push(issue(
        `"${title}" is disconnected and won't execute.`,
        node.id, undefined, "Canvas: connect this node to the workflow or delete it"
      ));
    }
  }

  // Check for nodes with no outputs but have outgoing edges
  const nodesWithOutputs = new Set(
    nodes.filter((n) => {
      const specId = n.data?.specId;
      return specId === "output" || specId === "input" || edges.some((e) => e.source === n.id);
    }).map((n) => n.id)
  );

  const nodesWithoutOutputs = nodes.filter(
    (n) => !nodesWithOutputs.has(n.id) && edges.some((e) => e.target === n.id)
  );

  for (const node of nodesWithoutOutputs) {
    const title = node.data?.title ?? node.data?.config?.name ?? "Node";
    warnings.push(issue(
      `"${title}" may not produce outputs. Verify its connections.`,
      node.id, undefined, "Inspector / Canvas: check that this node has valid outputs"
    ));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
