// src/canvas/CanvasConfig.ts
// Connection rules and isValidConnection for workflow builder.
// Based on strict ALLOWED_CONNECTIONS map.

import type { Connection, Edge } from "reactflow";

/**
 * For each source specId, which target specIds it can connect TO.
 * If source is not in map, no connections allowed.
 */
export const ALLOWED_CONNECTIONS: Record<string, string[]> = {
  input: [
    "output",
    "merge",
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
  merge: ["output", "openai-chat", "openai-image", "condition", "json-parse", "delay", "loop", "template", "http-request"],
  "openai-chat": ["output", "merge", "condition", "json-parse"],
  "openai-embeddings": ["output", "merge", "condition"],
  "openai-image": ["output", "merge", "condition"],
  "http-request": ["output", "merge", "json-parse", "condition"],
  "json-parse": ["output", "merge", "openai-chat", "condition"],
  condition: [
    "output",
    "merge",
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
  loop: ["openai-chat", "http-request", "openai-image", "merge", "condition"],
  template: ["openai-chat", "merge", "output", "condition"],
};

export type GetNodes = () => Array<{ id: string; data?: { specId?: string } }>;
export type GetEdges = () => Array<{ source: string; target: string; targetHandle?: string | null }>;

/**
 * Returns true if the connection is valid per ALLOWED_CONNECTIONS.
 * Used by ReactFlow's isValidConnection prop.
 */
export function isValidConnection(
  connection: Connection | Edge,
  getNodes: GetNodes,
  getEdges: GetEdges
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
      ((e as { targetHandle?: string | null }).targetHandle ?? null) === targetHandle
  );
  if (existingToSameHandle.length >= 1) return false;

  return true;
}
