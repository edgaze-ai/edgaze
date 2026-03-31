import { createHash } from "node:crypto";
import type { GraphEdge, GraphNode } from "../flow/types";

import {
  createWorkflowDefinitionFromBuilderGraph,
  normalizeWorkflowEdges,
  normalizeWorkflowNodes,
} from "./graph-normalizer";
import { WorkflowCompileError } from "./errors";
import { buildCompiledBindings } from "./port-validator";
import { getDefaultFailurePolicy, resolveWorkflowNodeSpec } from "./specs";
import type {
  CompiledEdge,
  CompiledNode,
  CompiledWorkflowDefinition,
  WorkflowDefinition,
} from "./types";

export { WorkflowCompileError } from "./errors";

function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function stableStringify(value: Record<string, unknown> | unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",");
  return `{${body}}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }
  return value;
}

function createSnapshotHash(params: {
  workflowId?: string;
  versionId?: string | null;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
  topoOrder: string[];
  entryNodeIds: string[];
  terminalNodeIds: string[];
  dependencyMap: Record<string, string[]>;
  downstreamMap: Record<string, string[]>;
}): string {
  const canonicalPayload = stableStringify(params);
  return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function compileWorkflowDefinition(
  definition: WorkflowDefinition,
): CompiledWorkflowDefinition {
  const nodes = normalizeWorkflowNodes(definition.nodes);
  const edges = normalizeWorkflowEdges(definition.edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const resolvedSpecsByNodeId = new Map<string, ReturnType<typeof resolveWorkflowNodeSpec>>();
  const errors: string[] = [];

  for (const node of nodes) {
    const resolvedSpec = resolveWorkflowNodeSpec(node.specId);
    if (!resolvedSpec) {
      errors.push(`Node "${node.id}" uses unsupported spec "${node.specId}".`);
      continue;
    }
    resolvedSpecsByNodeId.set(node.id, resolvedSpec);
  }

  let compiledEdges: CompiledEdge[] = [];
  const bindingsByNodeId = new Map<string, CompiledNode["inputBindings"]>();
  const sourceToTargetIds = new Map<string, Set<string>>();
  const targetToSourceIds = new Map<string, Set<string>>();

  try {
    const validated = buildCompiledBindings({ edges, nodes });
    compiledEdges = validated.compiledEdges;
    validated.bindingsByNodeId.forEach((bindings, nodeId) =>
      bindingsByNodeId.set(nodeId, bindings),
    );
    validated.sourceToTargetIds.forEach((ids, nodeId) => sourceToTargetIds.set(nodeId, ids));
    validated.targetToSourceIds.forEach((ids, nodeId) => targetToSourceIds.set(nodeId, ids));
  } catch (error) {
    if (error instanceof WorkflowCompileError) {
      errors.push(...error.details);
    } else {
      throw error;
    }
  }

  if (errors.length > 0) {
    throw new WorkflowCompileError("Workflow compilation failed validation.", errors);
  }

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, targetToSourceIds.get(node.id)?.size ?? 0);
    adjacency.set(node.id, sortStrings(sourceToTargetIds.get(node.id) ?? []));
  }

  const ready = sortStrings(
    [...indegree.entries()].filter(([, count]) => count === 0).map(([nodeId]) => nodeId),
  );
  const topoOrder: string[] = [];

  while (ready.length > 0) {
    const nodeId = ready.shift();
    if (!nodeId) break;
    topoOrder.push(nodeId);

    for (const downstreamId of adjacency.get(nodeId) ?? []) {
      const currentIndegree = indegree.get(downstreamId);
      if (currentIndegree === undefined) continue;

      const nextIndegree = currentIndegree - 1;
      indegree.set(downstreamId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(downstreamId);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (topoOrder.length !== nodes.length) {
    const cycleNodeIds = nodes
      .map((node) => node.id)
      .filter((nodeId) => !topoOrder.includes(nodeId))
      .sort((left, right) => left.localeCompare(right));
    throw new WorkflowCompileError(
      "Workflow contains a cycle and cannot be compiled deterministically.",
      cycleNodeIds.map((nodeId) => `Cycle involves node "${nodeId}".`),
    );
  }

  const topoIndexByNodeId = new Map(topoOrder.map((nodeId, index) => [nodeId, index]));
  const dependencyMap: Record<string, string[]> = {};
  const downstreamMap: Record<string, string[]> = {};
  const compiledNodes: CompiledNode[] = topoOrder.map((nodeId) => {
    const node = nodeById.get(nodeId);
    const resolvedSpec = resolvedSpecsByNodeId.get(nodeId);
    const topoIndex = topoIndexByNodeId.get(nodeId);
    if (!node || !resolvedSpec || topoIndex === undefined) {
      throw new WorkflowCompileError(
        `Internal compiler error while materializing node "${nodeId}".`,
      );
    }

    const dependencyNodeIds = sortStrings(targetToSourceIds.get(nodeId) ?? []);
    const downstreamNodeIds = sortStrings(sourceToTargetIds.get(nodeId) ?? []);
    dependencyMap[nodeId] = dependencyNodeIds;
    downstreamMap[nodeId] = downstreamNodeIds;

    return {
      id: node.id,
      specId: node.specId,
      title: node.title,
      config: node.config,
      failurePolicy: getDefaultFailurePolicy(node.config),
      topoIndex,
      inputPorts: resolvedSpec.inputPorts,
      outputPorts: resolvedSpec.outputPorts,
      inputBindings: [...(bindingsByNodeId.get(nodeId) ?? [])].sort((left, right) =>
        left.bindingOrderKey.localeCompare(right.bindingOrderKey),
      ),
      dependencyNodeIds,
      downstreamNodeIds,
      isEntryNode: dependencyNodeIds.length === 0,
      isTerminalNode: downstreamNodeIds.length === 0,
    };
  });

  const entryNodeIds = compiledNodes
    .filter((node) => node.isEntryNode)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
  const terminalNodeIds = compiledNodes
    .filter((node) => node.isTerminalNode)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  const snapshotHash = createSnapshotHash({
    workflowId: definition.workflowId,
    versionId: definition.versionId ?? null,
    nodes: compiledNodes,
    edges: compiledEdges,
    topoOrder,
    entryNodeIds,
    terminalNodeIds,
    dependencyMap,
    downstreamMap,
  });

  return deepFreeze({
    workflowId: definition.workflowId,
    versionId: definition.versionId ?? null,
    snapshotHash,
    compiledAt: new Date().toISOString(),
    nodes: compiledNodes,
    edges: compiledEdges,
    topoOrder,
    entryNodeIds,
    terminalNodeIds,
    dependencyMap,
    downstreamMap,
  });
}

export function compileBuilderGraph(params: {
  workflowId?: string;
  versionId?: string | null;
  builderVersion?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}): CompiledWorkflowDefinition {
  return compileWorkflowDefinition(createWorkflowDefinitionFromBuilderGraph(params));
}
