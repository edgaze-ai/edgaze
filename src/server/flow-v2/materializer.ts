import type {
  CompiledNode,
  MaterializedNodeInput,
  MaterializedInputSourceValue,
  MaterializedNodeInputPort,
  PayloadReference,
  SerializableValue,
} from "./types";
import { readPayloadReferenceValue } from "./payload-store";

export const ENTRY_NODE_INPUT_PORT_ID = "__input__";
export const ENTRY_NODE_SOURCE_PORT_ID = "__run_input__";

export class NodeInputMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeInputMaterializationError";
  }
}

function sortSourceValues(values: MaterializedInputSourceValue[]): MaterializedInputSourceValue[] {
  return [...values].sort((left, right) => {
    const leftKey = [
      left.targetPortId,
      left.sourceNodeId,
      left.sourcePortId,
      left.objectEntryKey ?? "",
      left.edgeId,
    ].join("::");
    const rightKey = [
      right.targetPortId,
      right.sourceNodeId,
      right.sourcePortId,
      right.objectEntryKey ?? "",
      right.edgeId,
    ].join("::");
    return leftKey.localeCompare(rightKey);
  });
}

function pickEntryNodeValue(
  compiledNode: CompiledNode,
  runInput: Record<string, SerializableValue>,
): {
  sourceNodeId: "__run_input__" | "__node_config__";
  sourcePortId: string;
  value: SerializableValue;
} {
  const externalInput = runInput[compiledNode.id];
  if (externalInput !== undefined) {
    return {
      sourceNodeId: "__run_input__",
      sourcePortId: ENTRY_NODE_SOURCE_PORT_ID,
      value: externalInput,
    };
  }

  const configValue =
    compiledNode.config.value ??
    compiledNode.config.text ??
    compiledNode.config.defaultValue ??
    null;

  return {
    sourceNodeId: "__node_config__",
    sourcePortId: "defaultValue",
    value: configValue,
  };
}

export function materializeNodeInput(params: {
  runId: string;
  attemptNumber: number;
  compiledNode: CompiledNode;
  runInput: Record<string, SerializableValue>;
  upstreamOutputsByNodeId: Record<string, PayloadReference | SerializableValue | undefined>;
}): MaterializedNodeInput {
  const { compiledNode } = params;

  if (compiledNode.specId === "input") {
    const entryValue = pickEntryNodeValue(compiledNode, params.runInput);
    const entrySources: MaterializedNodeInputPort["sources"] = [
      {
        edgeId: "__entry__",
        targetPortId: ENTRY_NODE_INPUT_PORT_ID,
        sourceNodeId: entryValue.sourceNodeId,
        sourcePortId: entryValue.sourcePortId,
        value: entryValue.value,
      },
    ];
    const syntheticPort: MaterializedNodeInputPort = {
      targetPortId: ENTRY_NODE_INPUT_PORT_ID,
      multiplicity: "single",
      valueType: "any",
      value: entryValue.value,
      sources: entrySources,
    };

    // Mirror the same value onto every declared spec input port (e.g. in-left) so
    // getInboundValues() (which indexes by port id) matches the legacy input handler
    // and downstream tooling — previously only __input__ was set, so ports were undefined.
    const ports: Record<string, MaterializedNodeInputPort> = {
      [ENTRY_NODE_INPUT_PORT_ID]: syntheticPort,
    };
    for (const port of compiledNode.inputPorts) {
      ports[port.id] = {
        targetPortId: port.id,
        multiplicity: port.multiplicity,
        valueType: port.valueType,
        value: entryValue.value,
        sources: entrySources.map((source) => ({
          ...source,
          targetPortId: port.id,
        })),
      };
    }

    return {
      runId: params.runId,
      nodeId: compiledNode.id,
      specId: compiledNode.specId,
      attemptNumber: params.attemptNumber,
      config: compiledNode.config,
      ports,
    };
  }

  const sourceValues = sortSourceValues(
    compiledNode.inputBindings.map((binding) => {
      const payload = params.upstreamOutputsByNodeId[binding.sourceNodeId];
      const value = readPayloadReferenceValue(payload);

      if (value === undefined) {
        throw new NodeInputMaterializationError(
          `Node "${compiledNode.id}" is missing upstream output from "${binding.sourceNodeId}" while materializing port "${binding.targetPortId}".`,
        );
      }

      const resolvedValue =
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        binding.sourcePortId in (value as Record<string, SerializableValue>)
          ? ((value as Record<string, SerializableValue>)[binding.sourcePortId] ?? null)
          : value;

      return {
        edgeId: binding.edgeId,
        targetPortId: binding.targetPortId,
        sourceNodeId: binding.sourceNodeId,
        sourcePortId: binding.sourcePortId,
        objectEntryKey: binding.objectEntryKey,
        value: resolvedValue,
      };
    }),
  );

  const sourceValuesByTargetPortId = new Map<string, MaterializedInputSourceValue[]>();
  for (const sourceValue of sourceValues) {
    const existing = sourceValuesByTargetPortId.get(sourceValue.targetPortId);
    if (existing) {
      existing.push(sourceValue);
    } else {
      sourceValuesByTargetPortId.set(sourceValue.targetPortId, [sourceValue]);
    }
  }

  const ports: Record<string, MaterializedNodeInputPort> = {};
  for (const port of compiledNode.inputPorts) {
    const matchingSources = sourceValuesByTargetPortId.get(port.id) ?? [];
    if (matchingSources.length === 0) continue;

    let value: SerializableValue;
    if (port.multiplicity === "single") {
      const [firstSource] = matchingSources;
      if (!firstSource) {
        throw new NodeInputMaterializationError(
          `Node "${compiledNode.id}" is missing a value for single input port "${port.id}".`,
        );
      }
      value = firstSource.value;
    } else if (port.multiplicity === "multi_list") {
      value = matchingSources.map((source) => source.value);
    } else {
      const objectValue: Record<string, SerializableValue> = {};
      for (const source of matchingSources) {
        const objectKey = source.objectEntryKey ?? source.sourceNodeId;
        if (objectKey in objectValue) {
          throw new NodeInputMaterializationError(
            `Node "${compiledNode.id}" received a duplicate multi_object key "${objectKey}" for port "${port.id}".`,
          );
        }
        objectValue[objectKey] = source.value;
      }
      value = objectValue;
    }

    ports[port.id] = {
      targetPortId: port.id,
      multiplicity: port.multiplicity,
      valueType: port.valueType,
      value,
      sources: matchingSources,
    };
  }

  return {
    runId: params.runId,
    nodeId: compiledNode.id,
    specId: compiledNode.specId,
    attemptNumber: params.attemptNumber,
    config: compiledNode.config,
    ports,
  };
}
