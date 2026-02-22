/**
 * IO contracts for node specs. Validate on publish + run for marketplace determinism.
 */

import { z } from "zod";
import { coerceToType, type ValueType } from "./value-types";

const KNOWN_SPEC_IDS = new Set([
  "input", "merge", "merge-json", "output",
  "openai-chat", "openai-embeddings", "openai-image",
  "http-request", "json-parse", "condition", "delay", "loop",
  "template", "map",
]);

export const VALUE_TYPES = ["string", "number", "boolean", "json", "array", "binary"] as const;
export type { ValueType };

export type NodeContract = {
  specId: string;
  inputTypes: ValueType[];
  outputType: ValueType;
  configSchema: z.ZodSchema;
  hasSideEffects?: boolean;
  resourceClass?: "llm" | "http" | "image" | "cpu";
};

const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const jsonSchema = z.record(z.string(), z.unknown()).or(z.array(z.unknown()));
const arraySchema = z.array(z.unknown());
const anySchema = z.unknown();

const commonConfig = z.object({
  timeout: z.number().optional(),
  retries: z.number().optional(),
  failurePolicy: z.enum(["fail_fast", "continue", "skip_downstream", "use_fallback_value"]).optional(),
  fallbackValue: z.unknown().optional(),
});

const CONTRACTS: Record<string, NodeContract> = {
  input: {
    specId: "input",
    inputTypes: [],
    outputType: "json",
    configSchema: commonConfig.extend({
      name: z.string().optional(),
      question: z.string().optional(),
      inputType: z.string().optional(),
      value: z.unknown().optional(),
    }),
    resourceClass: "cpu",
  },
  merge: {
    specId: "merge",
    inputTypes: ["string", "json", "array"],
    outputType: "string",
    configSchema: commonConfig,
    resourceClass: "cpu",
  },
  "merge-json": {
    specId: "merge-json",
    inputTypes: ["json"],
    outputType: "json",
    configSchema: commonConfig,
    resourceClass: "cpu",
  },
  output: {
    specId: "output",
    inputTypes: ["string", "json", "array"],
    outputType: "json",
    configSchema: commonConfig.extend({ format: z.string().optional() }),
    resourceClass: "cpu",
  },
  "openai-chat": {
    specId: "openai-chat",
    inputTypes: ["string", "json"],
    outputType: "json",
    configSchema: commonConfig.extend({
      prompt: z.string().optional(),
      system: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
    }),
    resourceClass: "llm",
  },
  "openai-embeddings": {
    specId: "openai-embeddings",
    inputTypes: ["string"],
    outputType: "array",
    configSchema: commonConfig.extend({ text: z.string().optional(), model: z.string().optional() }),
    resourceClass: "llm",
  },
  "openai-image": {
    specId: "openai-image",
    inputTypes: ["string"],
    outputType: "string",
    configSchema: commonConfig.extend({
      prompt: z.string().optional(),
      model: z.string().optional(),
      size: z.string().optional(),
      quality: z.string().optional(),
    }),
    resourceClass: "image",
  },
  "http-request": {
    specId: "http-request",
    inputTypes: ["string", "json"],
    outputType: "json",
    configSchema: commonConfig.extend({
      url: z.string().optional(),
      method: z.string().optional(),
      allowOnly: z.union([z.string(), z.array(z.string())]).optional(),
      denyHosts: z.union([z.string(), z.array(z.string())]).optional(),
      hasSideEffects: z.boolean().optional(),
      idempotencyKey: z.string().optional(),
    }),
    hasSideEffects: true,
    resourceClass: "http",
  },
  "json-parse": {
    specId: "json-parse",
    inputTypes: ["string"],
    outputType: "json",
    configSchema: commonConfig,
    resourceClass: "cpu",
  },
  condition: {
    specId: "condition",
    inputTypes: ["string", "json", "number", "boolean"],
    outputType: "boolean",
    configSchema: commonConfig.extend({
      operator: z.string().optional(),
      compareValue: z.unknown().optional(),
      humanCondition: z.string().optional(),
    }),
    resourceClass: "cpu",
  },
  delay: {
    specId: "delay",
    inputTypes: ["string", "json", "array"],
    outputType: "json",
    configSchema: commonConfig.extend({ duration: z.number().optional() }),
    resourceClass: "cpu",
  },
  loop: {
    specId: "loop",
    inputTypes: ["array"],
    outputType: "array",
    configSchema: commonConfig.extend({ maxIterations: z.number().optional() }),
    resourceClass: "cpu",
  },
  template: {
    specId: "template",
    inputTypes: ["string", "json"],
    outputType: "string",
    configSchema: commonConfig.extend({
      template: z.string().optional(),
    }),
    resourceClass: "cpu",
  },
  map: {
    specId: "map",
    inputTypes: ["array"],
    outputType: "array",
    configSchema: commonConfig.extend({
      template: z.string().optional(),
    }),
    resourceClass: "cpu",
  },
};

export function getContract(specId: string): NodeContract | undefined {
  return CONTRACTS[specId];
}

/** Coerce and validate inbound value for a node's input port. */
export function coerceInbound(specId: string, portIndex: number, value: unknown): unknown {
  const contract = getContract(specId);
  if (!contract) return value;
  const accepted = contract.inputTypes;
  if (accepted.length === 0) return value;
  const target = accepted[Math.min(portIndex, accepted.length - 1)] ?? "json";
  return coerceToType(value, target);
}

export function validateNodeConfig(specId: string, config: unknown): { valid: boolean; error?: string } {
  const contract = getContract(specId);
  if (!contract) return { valid: true }; // Unknown spec - will fail elsewhere
  try {
    contract.configSchema.parse(config ?? {});
    return { valid: true };
  } catch (e: unknown) {
    const err = e as z.ZodError;
    const msg = err.issues?.map((x) => `${x.path.map(String).join(".")}: ${x.message}`).join("; ");
    return { valid: false, error: msg || String(e) };
  }
}

export function validateWorkflowOnPublish(nodes: { id?: string; data?: { specId?: string; config?: unknown } }[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const node of nodes) {
    const specId = node.data?.specId ?? "unknown";
    if (specId === "unknown") {
      errors.push(`Node ${node.id ?? "?"} has unknown specId`);
      continue;
    }
    if (!KNOWN_SPEC_IDS.has(specId)) {
      errors.push(`Node ${node.id ?? "?"} uses unknown specId "${specId}"`);
      continue;
    }
    if (specId === "map") {
      const cfg = (node.data?.config ?? {}) as Record<string, unknown>;
      if (typeof cfg === "object" && cfg !== null && "transform" in cfg && cfg.transform != null) {
        errors.push(`Node ${node.id ?? "?"} (map): Map node no longer supports transform/expression. Use template interpolation only.`);
      }
      if (typeof cfg === "object" && cfg !== null && "expression" in cfg && cfg.expression != null) {
        errors.push(`Node ${node.id ?? "?"} (map): Map node no longer supports transform/expression. Use template interpolation only.`);
      }
    }
    const result = validateNodeConfig(specId, node.data?.config);
    if (!result.valid && result.error) {
      errors.push(`Node ${node.id ?? "?"} (${specId}): ${result.error}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function nodeHasSideEffects(specId: string, config?: Record<string, unknown>): boolean {
  const contract = getContract(specId);
  if (contract?.hasSideEffects) return true;
  return !!config?.hasSideEffects;
}
