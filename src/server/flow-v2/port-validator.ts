import { WorkflowCompileError } from "./errors";
import { isPortTypeCompatible, resolveWorkflowNodeSpec, validateNodeInputBindings } from "./specs";
import type {
  CompiledEdge,
  CompiledInputBinding,
  PortSpec,
  WorkflowDefinitionEdge,
  WorkflowDefinitionNode,
} from "./types";

function getPortById(ports: PortSpec[], portId: string): PortSpec | undefined {
  return ports.find((port) => port.id === portId);
}

export function resolvePortId(params: {
  nodeId: string;
  specId: string;
  edgeId: string;
  providedPortId: string | undefined;
  kind: "input" | "output";
}): string {
  const resolvedSpec = resolveWorkflowNodeSpec(params.specId);
  if (!resolvedSpec) {
    throw new WorkflowCompileError(`Unknown node spec "${params.specId}" on node "${params.nodeId}".`);
  }

  const ports = params.kind === "input" ? resolvedSpec.inputPorts : resolvedSpec.outputPorts;

  if (params.providedPortId) {
    const matchingPort = getPortById(ports, params.providedPortId);
    if (matchingPort) {
      return matchingPort.id;
    }
    if (ports.length === 1 && ports[0]) {
      return ports[0].id;
    }
    throw new WorkflowCompileError(
      `Edge "${params.edgeId}" references missing ${params.kind} port "${params.providedPortId}" on node "${params.nodeId}" (available: ${ports.map((p) => p.id).join(", ") || "none"}).`,
    );
  }

  if (ports.length === 1) {
    const onlyPort = ports[0];
    if (!onlyPort) {
      throw new WorkflowCompileError(
        `Node "${params.nodeId}" has an empty ${params.kind} port definition list.`,
      );
    }
    return onlyPort.id;
  }

  throw new WorkflowCompileError(
    `Edge "${params.edgeId}" must specify a ${params.kind} port on node "${params.nodeId}" because the node exposes multiple ${params.kind} ports.`,
  );
}

export function buildCompiledBindings(params: {
  edges: WorkflowDefinitionEdge[];
  nodes: WorkflowDefinitionNode[];
}) {
  const nodeById = new Map(params.nodes.map((node) => [node.id, node]));
  const compiledEdges: CompiledEdge[] = [];
  const bindingsByNodeId = new Map<string, CompiledInputBinding[]>();
  const sourceToTargetIds = new Map<string, Set<string>>();
  const targetToSourceIds = new Map<string, Set<string>>();
  const errors: string[] = [];

  for (const edge of params.edges) {
    const sourceNode = nodeById.get(edge.sourceNodeId);
    const targetNode = nodeById.get(edge.targetNodeId);
    if (!sourceNode) {
      errors.push(`Edge "${edge.id}" references missing source node "${edge.sourceNodeId}".`);
      continue;
    }
    if (!targetNode) {
      errors.push(`Edge "${edge.id}" references missing target node "${edge.targetNodeId}".`);
      continue;
    }

    const sourceSpec = resolveWorkflowNodeSpec(sourceNode.specId);
    const targetSpec = resolveWorkflowNodeSpec(targetNode.specId);
    if (!sourceSpec || !targetSpec) continue;

    const sourcePortId = resolvePortId({
      nodeId: sourceNode.id,
      specId: sourceNode.specId,
      edgeId: edge.id ?? "(edge)",
      providedPortId: edge.sourcePortId,
      kind: "output",
    });
    const targetPortId = resolvePortId({
      nodeId: targetNode.id,
      specId: targetNode.specId,
      edgeId: edge.id ?? "(edge)",
      providedPortId: edge.targetPortId,
      kind: "input",
    });

    const sourcePort = getPortById(sourceSpec.outputPorts, sourcePortId);
    const targetPort = getPortById(targetSpec.inputPorts, targetPortId);
    if (!sourcePort || !targetPort) {
      errors.push(`Edge "${edge.id}" references unresolved ports after normalization.`);
      continue;
    }

    if (!isPortTypeCompatible(sourcePort.valueType, targetPort.valueType)) {
      errors.push(
        `Edge "${edge.id}" connects incompatible ports: ${sourceNode.id}.${sourcePortId} (${sourcePort.valueType}) -> ${targetNode.id}.${targetPortId} (${targetPort.valueType}).`,
      );
      continue;
    }

    const bindingOrderKey = [
      targetNode.id,
      targetPortId,
      sourceNode.id,
      sourcePortId,
      edge.id ?? "",
    ].join("::");

    compiledEdges.push({
      id: edge.id ?? bindingOrderKey,
      sourceNodeId: sourceNode.id,
      sourcePortId,
      targetNodeId: targetNode.id,
      targetPortId,
      bindingOrderKey,
    });

    const targetBindings = bindingsByNodeId.get(targetNode.id) ?? [];
    targetBindings.push({
      edgeId: edge.id ?? bindingOrderKey,
      targetPortId,
      targetNodeId: targetNode.id,
      sourceNodeId: sourceNode.id,
      sourcePortId,
      sourceValueType: sourcePort.valueType,
      targetValueType: targetPort.valueType,
      multiplicity: targetPort.multiplicity,
      objectEntryKey: targetPort.multiplicity === "multi_object" ? sourceNode.id : undefined,
      bindingOrderKey,
    });
    bindingsByNodeId.set(targetNode.id, targetBindings);

    if (!sourceToTargetIds.has(sourceNode.id)) sourceToTargetIds.set(sourceNode.id, new Set());
    sourceToTargetIds.get(sourceNode.id)?.add(targetNode.id);

    if (!targetToSourceIds.has(targetNode.id)) targetToSourceIds.set(targetNode.id, new Set());
    targetToSourceIds.get(targetNode.id)?.add(sourceNode.id);
  }

  for (const node of params.nodes) {
    const resolvedSpec = resolveWorkflowNodeSpec(node.specId);
    if (!resolvedSpec) continue;

    const bindings = [...(bindingsByNodeId.get(node.id) ?? [])].sort((left, right) =>
      left.bindingOrderKey.localeCompare(right.bindingOrderKey),
    );
    const validationErrors = validateNodeInputBindings({
      inputPorts: resolvedSpec.inputPorts,
      inputBindings: bindings.map((binding) => ({
        targetPortId: binding.targetPortId,
        sourceNodeId: binding.sourceNodeId,
        sourcePortId: binding.sourcePortId,
        edgeId: binding.edgeId,
      })),
      inputRequirement: resolvedSpec.inputRequirement,
    });
    errors.push(...validationErrors);

    for (const port of resolvedSpec.inputPorts) {
      const portBindings = bindings.filter((binding) => binding.targetPortId === port.id);
      if (port.multiplicity === "single" && portBindings.length > 1) {
        errors.push(
          `Node "${node.id}" received multiple inbound bindings for single port "${port.id}".`,
        );
      }

      if (port.multiplicity === "single") continue;
      if (port.multiplicity === "multi_object") {
        const seenKeys = new Set<string>();
        for (const binding of portBindings) {
          const key = binding.objectEntryKey ?? binding.sourceNodeId;
          if (seenKeys.has(key)) {
            errors.push(
              `Node "${node.id}" has a multi_object key collision on port "${port.id}" for key "${key}".`,
            );
          }
          seenKeys.add(key);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new WorkflowCompileError("Workflow port validation failed.", errors);
  }

  return {
    compiledEdges: compiledEdges.sort((left, right) =>
      left.bindingOrderKey.localeCompare(right.bindingOrderKey),
    ),
    bindingsByNodeId,
    sourceToTargetIds,
    targetToSourceIds,
  };
}
