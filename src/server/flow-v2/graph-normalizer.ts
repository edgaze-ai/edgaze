import {
  canonicalSpecId,
  LEGACY_OPENAI_CHAT_CONFIG_FLAG,
  LEGACY_OPENAI_IMAGE_CONFIG_FLAG,
} from "@lib/workflow/spec-id-aliases";

import type { GraphEdge, GraphNode } from "../flow/types";
import { WorkflowCompileError } from "./errors";
import type {
  SerializableValue,
  WorkflowDefinition,
  WorkflowDefinitionEdge,
  WorkflowDefinitionNode,
} from "./types";

function normalizeWorkflowDefinitionNode(node: WorkflowDefinitionNode): WorkflowDefinitionNode {
  const rawSpec = String(node.specId ?? "").trim();
  const lower = rawSpec.toLowerCase();
  const config: Record<string, SerializableValue> = { ...(node.config ?? {}) };
  if (lower === "openai-chat") {
    config[LEGACY_OPENAI_CHAT_CONFIG_FLAG] = true;
  }
  if (lower === "openai-image") {
    config[LEGACY_OPENAI_IMAGE_CONFIG_FLAG] = true;
  }
  return {
    id: node.id,
    specId: canonicalSpecId(rawSpec),
    title: node.title,
    config,
  };
}

function sortEdges(edges: WorkflowDefinitionEdge[]): WorkflowDefinitionEdge[] {
  return [...edges].sort((left, right) => {
    const leftKey = [
      left.sourceNodeId,
      left.sourcePortId ?? "",
      left.targetNodeId,
      left.targetPortId ?? "",
      left.id ?? "",
    ].join("::");
    const rightKey = [
      right.sourceNodeId,
      right.sourcePortId ?? "",
      right.targetNodeId,
      right.targetPortId ?? "",
      right.id ?? "",
    ].join("::");
    return leftKey.localeCompare(rightKey);
  });
}

export function normalizeWorkflowNodes(nodes: WorkflowDefinitionNode[]): WorkflowDefinitionNode[] {
  const errors: string[] = [];
  const seenNodeIds = new Set<string>();

  const normalizedNodes = [...nodes]
    .map((node) => {
      if (!node.id.trim()) errors.push("Workflow contains a node with an empty id.");
      if (seenNodeIds.has(node.id)) errors.push(`Duplicate node id "${node.id}".`);
      seenNodeIds.add(node.id);

      return normalizeWorkflowDefinitionNode({
        id: node.id,
        specId: String(node.specId ?? "").trim(),
        title: node.title,
        config: node.config ?? {},
      });
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  if (errors.length > 0) {
    throw new WorkflowCompileError("Workflow node normalization failed.", errors);
  }

  return normalizedNodes;
}

export function normalizeWorkflowEdges(edges: WorkflowDefinitionEdge[]): WorkflowDefinitionEdge[] {
  const seenEdgeIds = new Set<string>();
  const errors: string[] = [];

  const normalized = sortEdges(edges).map((edge) => {
    const derivedId =
      edge.id ??
      `${edge.sourceNodeId}:${edge.sourcePortId ?? "*"}->${edge.targetNodeId}:${edge.targetPortId ?? "*"}`;

    if (seenEdgeIds.has(derivedId)) {
      errors.push(`Duplicate edge id "${derivedId}".`);
    }
    seenEdgeIds.add(derivedId);

    return {
      id: derivedId,
      sourceNodeId: edge.sourceNodeId,
      sourcePortId: edge.sourcePortId,
      targetNodeId: edge.targetNodeId,
      targetPortId: edge.targetPortId,
    };
  });

  if (errors.length > 0) {
    throw new WorkflowCompileError("Workflow edge normalization failed.", errors);
  }

  return normalized;
}

export function createWorkflowDefinitionFromBuilderGraph(params: {
  workflowId?: string;
  versionId?: string | null;
  builderVersion?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}): WorkflowDefinition {
  return {
    workflowId: params.workflowId,
    versionId: params.versionId ?? null,
    builderVersion: params.builderVersion ?? null,
    nodes: params.nodes.map((node) =>
      normalizeWorkflowDefinitionNode({
        id: node.id,
        specId: String(node.data?.specId ?? "unknown").trim(),
        title: node.data?.title,
        config: (node.data?.config ?? {}) as Record<string, SerializableValue>,
      }),
    ),
    edges: params.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source,
      sourcePortId: edge.sourceHandle,
      targetNodeId: edge.target,
      targetPortId: edge.targetHandle,
    })),
  };
}
