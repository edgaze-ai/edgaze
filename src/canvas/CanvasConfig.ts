// src/canvas/CanvasConfig.ts
// Connection rules and isValidConnection for workflow builder.
// Based on strict ALLOWED_CONNECTIONS map.

import type { Connection, Edge } from "reactflow";

// "Data" connections: these targets accept inbound values via the workflow data pipeline.
// Keep this permissive for LLM chaining (LLM → LLM) while still guarding structural rules below.
const CHAT_TARGETS = [
  "output",
  "merge",
  "condition",
  "json-parse",
  // Allow chaining between LLM nodes
  "llm-chat",
  "openai-chat",
  "llm-embeddings",
  "openai-embeddings",
  "llm-image",
  "openai-image",
];
const EMBED_TARGETS = [
  "output",
  "merge",
  "condition",
  // Allow embeddings → LLM (e.g. stringify vectors, pass IDs/metadata)
  "llm-chat",
  "openai-chat",
  "llm-image",
  "openai-image",
];
const IMAGE_TARGETS = [
  "output",
  "merge",
  "condition",
  // Allow image results → chat prompts, etc.
  "llm-chat",
  "openai-chat",
  "json-parse",
];

/**
 * For each source specId, which target specIds it can connect TO.
 * If source is not in map, no connections allowed.
 * Includes legacy openai-* ids for saved workflows.
 */
export const ALLOWED_CONNECTIONS: Record<string, string[]> = {
  input: [
    "output",
    "merge",
    "llm-chat",
    "llm-embeddings",
    "llm-image",
    "openai-chat",
    "openai-embeddings",
    "openai-image",
    "http-request",
    "json-parse",
    "condition",
    "delay",
    "loop",
    "template",
  ],
  output: [], // no outputs
  merge: [
    "output",
    "merge",
    "llm-chat",
    "llm-image",
    "openai-chat",
    "openai-image",
    "condition",
    "json-parse",
    "delay",
    "loop",
    "template",
    "http-request",
  ],
  "llm-chat": CHAT_TARGETS,
  "openai-chat": CHAT_TARGETS,
  "llm-embeddings": EMBED_TARGETS,
  "openai-embeddings": EMBED_TARGETS,
  "llm-image": IMAGE_TARGETS,
  "openai-image": IMAGE_TARGETS,
  "http-request": ["output", "merge", "json-parse", "condition"],
  "json-parse": ["output", "merge", "llm-chat", "openai-chat", "condition"],
  condition: [
    "output",
    "merge",
    "llm-chat",
    "llm-embeddings",
    "llm-image",
    "openai-chat",
    "openai-embeddings",
    "openai-image",
    "http-request",
    "json-parse",
    "condition",
    "delay",
    "loop",
    "template",
  ],
  delay: [
    "output",
    "merge",
    "llm-chat",
    "llm-embeddings",
    "llm-image",
    "openai-chat",
    "openai-embeddings",
    "openai-image",
    "http-request",
    "json-parse",
    "condition",
    "delay",
    "loop",
    "template",
  ],
  loop: [
    "llm-chat",
    "openai-chat",
    "http-request",
    "llm-image",
    "openai-image",
    "merge",
    "condition",
  ],
  template: ["llm-chat", "openai-chat", "merge", "output", "condition"],
};

export type GetNodes = () => Array<{ id: string; data?: { specId?: string } }>;
export type GetEdges = () => Array<{
  source: string;
  target: string;
  targetHandle?: string | null;
}>;

/**
 * Returns true if the connection is valid per ALLOWED_CONNECTIONS.
 * Used by ReactFlow's isValidConnection prop.
 */
export function isValidConnection(
  connection: Connection | Edge,
  getNodes: GetNodes,
  getEdges: GetEdges,
): boolean {
  const { source, target } = connection;
  if (!source || !target) return false;

  const nodes = getNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  if (!sourceNode || !targetNode) return false;

  // No self-connections
  if (source === target) return false;

  const sourceSpecId = sourceNode.data?.specId;
  const targetSpecId = targetNode.data?.specId;

  if (!sourceSpecId || !targetSpecId) return false;

  // Output nodes cannot send connections
  if (sourceSpecId === "output") return false;

  // Input nodes cannot receive connections
  if (targetSpecId === "input") return false;

  // Use ALLOWED_CONNECTIONS
  const allowedTargets = ALLOWED_CONNECTIONS[sourceSpecId];
  if (!allowedTargets || !Array.isArray(allowedTargets)) return false;
  if (!allowedTargets.includes(targetSpecId)) return false;

  // Output nodes: only 1 input connection (replace existing)
  if (targetSpecId === "output") {
    const edges = getEdges();
    const existingToOutput = edges.filter((e) => e.target === target);
    // Allow if replacing (we'll replace in onConnect) or if none exist
    return existingToOutput.length <= 1;
  }

  // Input nodes: only 1 output connection
  if (sourceSpecId === "input") {
    const edges = getEdges();
    const existingFromInput = edges.filter((e) => e.source === source);
    return existingFromInput.length === 0;
  }

  // Condition: only 1 input connection
  if (targetSpecId === "condition") {
    const edges = getEdges();
    const existingToCondition = edges.filter((e) => e.target === target);
    return existingToCondition.length === 0;
  }

  // Same target handle cannot receive multiple edges (no duplicate handle connections)
  const targetHandle = (connection as Connection).targetHandle ?? null;
  const edges = getEdges();
  const existingToSameHandle = edges.filter(
    (e) =>
      e.target === target &&
      ((e as { targetHandle?: string | null }).targetHandle ?? null) === targetHandle,
  );
  if (existingToSameHandle.length >= 1) return false;

  return true;
}
