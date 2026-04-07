import { getNodeSpec } from "@/nodes/registry";
import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";

import type {
  FailurePolicy,
  PortMultiplicity,
  PortSpec,
  PortValueType,
  SerializableValue,
} from "./types";

type InputRequirement =
  | { kind: "none" }
  | { kind: "entry_only" }
  | { kind: "minimum_bindings"; count: number }
  | { kind: "required_ports"; portIds: string[] }
  | { kind: "ports_or_config"; portIds: string[]; configKeys: string[] };

export interface ResolvedWorkflowNodeSpec {
  specId: string;
  canonicalSpecId: string;
  inputPorts: PortSpec[];
  outputPorts: PortSpec[];
  inputRequirement: InputRequirement;
}

type LegacyPortSpec = {
  inputPorts: PortSpec[];
  outputPorts: PortSpec[];
  inputRequirement: InputRequirement;
};

const DEFAULT_FAILURE_POLICY: FailurePolicy = "fail_fast";

const LEGACY_RUNTIME_ONLY_SPECS: Record<string, LegacyPortSpec> = {
  "merge-json": {
    inputPorts: [
      {
        id: "in-1",
        name: "in-1",
        kind: "input",
        label: "in 1",
        valueType: "object",
        required: false,
        multiplicity: "single",
      },
      {
        id: "in-2",
        name: "in-2",
        kind: "input",
        label: "in 2",
        valueType: "object",
        required: false,
        multiplicity: "single",
      },
      {
        id: "in-3",
        name: "in-3",
        kind: "input",
        label: "in 3",
        valueType: "object",
        required: false,
        multiplicity: "single",
      },
    ],
    outputPorts: [
      {
        id: "out",
        name: "out",
        kind: "output",
        label: "Merged",
        valueType: "object",
        required: false,
        multiplicity: "single",
      },
    ],
    inputRequirement: { kind: "minimum_bindings", count: 1 },
  },
  template: {
    inputPorts: [
      {
        id: "in",
        name: "in",
        kind: "input",
        label: "Data",
        valueType: "object",
        required: false,
        multiplicity: "single",
      },
    ],
    outputPorts: [
      {
        id: "out",
        name: "out",
        kind: "output",
        label: "Text",
        valueType: "string",
        required: false,
        multiplicity: "single",
      },
    ],
    inputRequirement: { kind: "none" },
  },
  map: {
    inputPorts: [
      {
        id: "array",
        name: "array",
        kind: "input",
        label: "Array",
        valueType: "array",
        required: true,
        multiplicity: "single",
      },
    ],
    outputPorts: [
      {
        id: "out",
        name: "out",
        kind: "output",
        label: "Mapped",
        valueType: "array",
        required: false,
        multiplicity: "single",
      },
    ],
    inputRequirement: { kind: "required_ports", portIds: ["array"] },
  },
};

const INPUT_REQUIREMENTS: Record<string, InputRequirement> = {
  input: { kind: "entry_only" },
  output: { kind: "minimum_bindings", count: 1 },
  merge: { kind: "minimum_bindings", count: 1 },
  "merge-json": { kind: "minimum_bindings", count: 1 },
  "llm-chat": { kind: "ports_or_config", portIds: ["in"], configKeys: ["prompt", "system"] },
  "llm-embeddings": { kind: "ports_or_config", portIds: ["in"], configKeys: ["text"] },
  "llm-image": { kind: "ports_or_config", portIds: ["in"], configKeys: ["prompt"] },
  "http-request": { kind: "ports_or_config", portIds: ["in"], configKeys: ["url"] },
  "json-parse": { kind: "minimum_bindings", count: 1 },
  condition: { kind: "required_ports", portIds: ["input"] },
  delay: { kind: "none" },
  loop: { kind: "required_ports", portIds: ["array"] },
  template: { kind: "none" },
  map: { kind: "required_ports", portIds: ["array"] },
};

function normalizePortType(rawType: string | undefined): PortValueType {
  if (!rawType) return "any";

  switch (rawType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "file":
      return "file";
    case "image":
      return "image";
    case "object":
      return "object";
    case "json":
      return "object";
    case "binary":
      return "binary";
    default:
      return "any";
  }
}

function inferMultiplicity(params: {
  canonicalSpecId: string;
  portId: string;
  kind: "input" | "output";
}): PortMultiplicity {
  if (params.kind === "output") return "single";
  if (params.canonicalSpecId === "merge" || params.canonicalSpecId === "merge-json") {
    return "single";
  }
  return "single";
}

function inferRequired(params: {
  canonicalSpecId: string;
  portId: string;
  kind: "input" | "output";
}): boolean {
  if (params.kind === "output") return false;
  const requirement = INPUT_REQUIREMENTS[params.canonicalSpecId];
  if (!requirement) return false;
  if (requirement.kind === "required_ports") {
    return requirement.portIds.includes(params.portId);
  }
  return false;
}

function toPortSpecs(
  canonicalSpec: string,
  ports: Array<{ id: string; kind: "input" | "output"; label?: string; type?: string }>,
): PortSpec[] {
  return ports.map((port) => ({
    id: port.id,
    name: port.id,
    kind: port.kind,
    label: port.label,
    valueType: normalizePortType(port.type),
    required: inferRequired({
      canonicalSpecId: canonicalSpec,
      portId: port.id,
      kind: port.kind,
    }),
    multiplicity: inferMultiplicity({
      canonicalSpecId: canonicalSpec,
      portId: port.id,
      kind: port.kind,
    }),
  }));
}

export function resolveWorkflowNodeSpec(specId: string): ResolvedWorkflowNodeSpec | undefined {
  const canonical = canonicalSpecId(specId);
  const registrySpec = getNodeSpec(specId) ?? getNodeSpec(canonical);

  if (registrySpec) {
    const compiledPorts = toPortSpecs(canonical, registrySpec.ports);
    return {
      specId,
      canonicalSpecId: canonical,
      inputPorts: compiledPorts.filter((port) => port.kind === "input"),
      outputPorts: compiledPorts.filter((port) => port.kind === "output"),
      inputRequirement: INPUT_REQUIREMENTS[canonical] ?? { kind: "none" },
    };
  }

  const runtimeOnly = LEGACY_RUNTIME_ONLY_SPECS[canonical];
  if (!runtimeOnly) return undefined;

  return {
    specId,
    canonicalSpecId: canonical,
    inputPorts: runtimeOnly.inputPorts,
    outputPorts: runtimeOnly.outputPorts,
    inputRequirement: runtimeOnly.inputRequirement,
  };
}

export function getDefaultFailurePolicy(config: Record<string, SerializableValue>): FailurePolicy {
  const raw = config.failurePolicy;
  if (raw === "fail_fast") return "fail_fast";
  if (raw === "continue") return "continue";
  if (raw === "skip_downstream") return "skip_downstream";
  if (raw === "use_fallback_value") return "use_fallback_value";
  return DEFAULT_FAILURE_POLICY;
}

export function isPortTypeCompatible(source: PortValueType, target: PortValueType): boolean {
  if (source === "any" || target === "any") return true;
  if (source === target) return true;

  if (source === "object" && target === "array") return true;
  /** Chat / HTTP / merge outputs are coerced to text via extractPipelineContent at runtime. */
  if (source === "object" && target === "string") return true;
  if (source === "image" && target === "file") return true;

  return false;
}

export function validateNodeInputBindings(params: {
  inputPorts: PortSpec[];
  inputBindings: Array<{
    targetPortId: string;
    sourceNodeId: string;
    sourcePortId: string;
    edgeId: string;
  }>;
  inputRequirement: InputRequirement;
  config?: Record<string, SerializableValue>;
}): string[] {
  const { inputBindings, config = {}, inputPorts, inputRequirement } = params;
  const bindingsByPort = new Map<string, number>();
  for (const binding of inputBindings) {
    bindingsByPort.set(binding.targetPortId, (bindingsByPort.get(binding.targetPortId) ?? 0) + 1);
  }
  const requirement = inputRequirement;
  const bindingCount = [...bindingsByPort.values()].reduce((sum, count) => sum + count, 0);

  const requiredPortErrors = inputPorts
    .filter(
      (port) => port.kind === "input" && port.required && (bindingsByPort.get(port.id) ?? 0) === 0,
    )
    .map((port) => `Port "${port.id}" is required but has no inbound binding.`);

  switch (requirement.kind) {
    case "none":
      return requiredPortErrors;
    case "entry_only":
      return bindingCount === 0
        ? requiredPortErrors
        : [...requiredPortErrors, "Entry-only node cannot accept inbound edges."];
    case "minimum_bindings":
      return bindingCount >= requirement.count
        ? requiredPortErrors
        : [
            ...requiredPortErrors,
            `Node requires at least ${requirement.count} inbound binding(s).`,
          ];
    case "required_ports":
      return [
        ...requiredPortErrors,
        ...requirement.portIds
          .filter((portId) => (bindingsByPort.get(portId) ?? 0) === 0)
          .map((portId) => `Node requires an inbound binding for port "${portId}".`),
      ];
    case "ports_or_config": {
      const hasBinding = requirement.portIds.some(
        (portId) => (bindingsByPort.get(portId) ?? 0) > 0,
      );
      const hasConfigFallback = requirement.configKeys.some((key) => {
        const value = config[key];
        if (typeof value === "string") return value.trim().length > 0;
        return value !== undefined && value !== null;
      });

      return hasBinding || hasConfigFallback
        ? requiredPortErrors
        : [
            ...requiredPortErrors,
            `Node requires either inbound data on one of [${requirement.portIds.join(", ")}] or config fallback in one of [${requirement.configKeys.join(", ")}].`,
          ];
    }
  }
}
