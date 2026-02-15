// src/lib/workflow/validation.ts
/**
 * Validates workflow graphs for potential issues that could cause high costs or errors
 */

export type GraphNode = {
  id: string;
  data?: {
    specId?: string;
    config?: any;
  };
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

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

function validateOpenAIImageNode(node: GraphNode): string[] {
  const config = node.data?.config ?? {};
  const model = config.model || "dall-e-2";
  const quality = config.quality || "standard";
  const size = config.size || "1024x1024";
  const name = config.name || node.data?.specId || "OpenAI Image";
  const errs: string[] = [];
  if (model === "dall-e-2" && quality === "hd") {
    errs.push(
      `${name}: Quality "HD" is only supported with DALL-E 3. In the inspector, either set Model to "DALL-E 3" or set Quality to "Standard".`
    );
  }
  if (model === "dall-e-2" && !DALL_E_2_SIZES.includes(size)) {
    errs.push(
      `${name}: Size "${size}" is not valid for DALL-E 2. In the inspector, choose Model "DALL-E 3" or set Size to one of: 256x256, 512x512, 1024x1024.`
    );
  }
  if (model === "dall-e-3" && !DALL_E_3_SIZES.includes(size)) {
    errs.push(
      `${name}: Size "${size}" is not valid for DALL-E 3. In the inspector, set Size to one of: 1024x1024, 1792x1024, 1024x1792.`
    );
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
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty workflow
  if (nodes.length === 0) {
    errors.push("Workflow must contain at least one node");
    return { valid: false, errors, warnings };
  }

  // Check for cycles
  if (hasCycle(nodes, edges)) {
    errors.push(
      "Workflow contains a circular dependency. This could cause infinite execution loops and excessive resource consumption. Please remove the circular connection."
    );
  }

  // Check node count
  if (nodes.length > MAX_NODES) {
    errors.push(
      `Workflow contains ${nodes.length} nodes, which exceeds the maximum of ${MAX_NODES}. Large workflows can consume significant resources. Please simplify your workflow.`
    );
  }

  // Validate OpenAI Image node config so invalid params are never sent to the API
  for (const node of nodes) {
    if (node.data?.specId === "openai-image") {
      const nodeErrors = validateOpenAIImageNode(node);
      errors.push(...nodeErrors);
    }
  }

  // Check for expensive nodes
  const expensiveNodes = nodes.filter(
    (n) => EXPENSIVE_NODE_TYPES.includes(n.data?.specId || "")
  );

  if (expensiveNodes.length > MAX_EXPENSIVE_NODES) {
    warnings.push(
      `Workflow contains ${expensiveNodes.length} nodes that make external service calls (AI models, APIs, etc.). Each execution will consume credits or incur charges. Consider optimizing your workflow to reduce the number of external calls.`
    );
  }

  // Check workflow depth
  const maxDepth = calculateMaxDepth(nodes, edges);
  if (maxDepth > MAX_DEPTH) {
    warnings.push(
      `Workflow has a depth of ${maxDepth} levels. Deep workflows can take longer to execute and consume more resources. Consider flattening your workflow structure.`
    );
  }

  // Check for disconnected nodes
  const connectedNodes = new Set<string>();
  edges.forEach((e) => {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  });

  const disconnectedNodes = nodes.filter((n) => !connectedNodes.has(n.id));
  if (disconnectedNodes.length > 0 && nodes.length > 1) {
    warnings.push(
      `Workflow contains ${disconnectedNodes.length} disconnected node(s). These nodes won't execute and may indicate an incomplete workflow.`
    );
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

  if (nodesWithoutOutputs.length > 0) {
    warnings.push(
      `Some nodes may not produce outputs correctly. Please verify all node connections are valid.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
