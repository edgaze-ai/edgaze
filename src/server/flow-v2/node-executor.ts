import type { GraphNode, RuntimeContext } from "../flow/types";
import { canonicalSpecId } from "@lib/workflow/spec-id-aliases";
import { CONDITION_PASSTHROUGH_KEY, CONDITION_RESULT_KEY } from "../nodes/handlers";
import {
  extractPipelineContent,
  normalizeToDisplayable,
  runtimeRegistry,
  safeToString,
} from "../nodes/handlers";

import { ENTRY_NODE_INPUT_PORT_ID } from "./materializer";
import { perfAsync, perfSync } from "./engine-perf";
import type {
  CompiledNode,
  MaterializedNodeInput,
  NodeExecutionResult,
  SerializableValue,
} from "./types";

export interface ExecuteNodeParams {
  compiledNode: CompiledNode;
  materializedInput: MaterializedNodeInput;
  runInput: Record<string, SerializableValue>;
  signal: AbortSignal;
  requestMetadata?: RuntimeContext["requestMetadata"];
  onStreamEvent?: RuntimeContext["streamNodeOutput"];
  /** When set, {@link LegacyNodeExecutorAdapter} emits engine-perf spans for this run. */
  perfRunId?: string;
}

export interface NodeExecutor {
  execute(params: ExecuteNodeParams): Promise<NodeExecutionResult>;
}

const RESULT_OUTPUT_PORT_ID = "__result__";
const FAST_LOCAL_SPEC_IDS = new Set(["input", "merge", "output"]);

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function getInboundValuesFromMaterializedInput(
  compiledNode: CompiledNode,
  materializedInput: MaterializedNodeInput,
): SerializableValue[] {
  return compiledNode.inputPorts.map(
    (port) => materializedInput.ports[port.id]?.value as SerializableValue,
  );
}

function executeFastLocalNode(params: {
  compiledNode: CompiledNode;
  materializedInput: MaterializedNodeInput;
  runInput: Record<string, SerializableValue>;
}): SerializableValue | null {
  const specId = canonicalSpecId(params.compiledNode.specId);

  if (specId === "input") {
    const external = params.runInput[params.compiledNode.id];
    let value: SerializableValue | "";
    if (external !== undefined && external !== null) {
      value = external;
    } else {
      const configValue =
        params.compiledNode.config.value ??
        params.compiledNode.config.text ??
        params.compiledNode.config.defaultValue;
      value =
        configValue !== undefined && configValue !== null && configValue !== ""
          ? (configValue as SerializableValue)
          : "";
    }

    const question =
      typeof params.compiledNode.config.question === "string"
        ? params.compiledNode.config.question.trim()
        : undefined;
    if (question && question.length > 0) {
      return { value, question };
    }
    return value;
  }

  const inbound = getInboundValuesFromMaterializedInput(
    params.compiledNode,
    params.materializedInput,
  );

  if (specId === "merge") {
    const valid = inbound.filter((v) => v !== null && v !== undefined);
    if (valid.length === 0) return "";
    const toMergeString = (v: unknown): string => safeToString(extractPipelineContent(v));
    if (valid.length === 1) return toMergeString(valid[0]);
    return valid.map((v) => toMergeString(v)).join("\n\n");
  }

  if (specId === "output") {
    const valid = inbound
      .filter((v) => v !== undefined && v !== null)
      .map((v) => extractPipelineContent(v));

    if (valid.length === 0) return null;
    if (valid.length === 1) {
      return normalizeToDisplayable(valid[0]) as SerializableValue | null;
    }

    return valid
      .map((v) => {
        const normalized = normalizeToDisplayable(v);
        return typeof normalized === "string" ? normalized : safeToString(normalized);
      })
      .filter((part) => part.trim().length > 0)
      .join("\n\n");
  }

  return null;
}

export class LegacyNodeExecutorAdapter implements NodeExecutor {
  async execute(params: ExecuteNodeParams): Promise<NodeExecutionResult> {
    const perfRunId = params.perfRunId;
    const specKey = canonicalSpecId(params.compiledNode.specId);
    const phaseMeta = {
      nodeId: params.compiledNode.id,
      specId: params.compiledNode.specId,
      canonicalSpecId: specKey,
      inputPortCount: params.compiledNode.inputPorts.length,
      outputPortCount: params.compiledNode.outputPorts.length,
    };
    const isFastLocalNode = FAST_LOCAL_SPEC_IDS.has(specKey);
    const handler = runtimeRegistry[specKey] ?? runtimeRegistry[params.compiledNode.specId];
    if (!handler && !isFastLocalNode) {
      return {
        status: "failed",
        error: {
          message: `No runtime handler registered for "${params.compiledNode.specId}".`,
          retryable: false,
        },
      };
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    let capturedOutput: SerializableValue | undefined;

    try {
      if (params.signal.aborted) {
        throw params.signal.reason instanceof Error
          ? params.signal.reason
          : abortError("Cancelled");
      }

      let handlerResult: SerializableValue | null | undefined;
      if (isFastLocalNode) {
        handlerResult = perfRunId
          ? perfSync(
              perfRunId,
              "node.handler.fast_local",
              () =>
                executeFastLocalNode({
                  compiledNode: params.compiledNode,
                  materializedInput: params.materializedInput,
                  runInput: params.runInput,
                }),
              phaseMeta,
            )
          : executeFastLocalNode({
              compiledNode: params.compiledNode,
              materializedInput: params.materializedInput,
              runInput: params.runInput,
            });
      } else {
        const runtimeHandler = handler!;
        const graphNode: GraphNode = {
          id: params.compiledNode.id,
          data: {
            specId: params.compiledNode.specId,
            title: params.compiledNode.title,
            config: params.compiledNode.config,
          },
        };

        const entryFallback = params.materializedInput.ports[ENTRY_NODE_INPUT_PORT_ID]?.value;
        const orderedInboundValues = perfRunId
          ? perfSync(
              perfRunId,
              "node.executor.buildInboundValues",
              () =>
                params.compiledNode.inputPorts.map((port) => {
                  const fromPort = params.materializedInput.ports[port.id]?.value;
                  if (fromPort !== undefined) return fromPort;
                  return entryFallback;
                }),
              phaseMeta,
            )
          : params.compiledNode.inputPorts.map((port) => {
              const fromPort = params.materializedInput.ports[port.id]?.value;
              if (fromPort !== undefined) return fromPort;
              return entryFallback;
            });

        const ctx: RuntimeContext = {
          inputs: perfRunId
            ? perfSync(
                perfRunId,
                "node.executor.spreadRunInput",
                () => ({
                  ...params.runInput,
                }),
                phaseMeta,
              )
            : {
                ...params.runInput,
              },
          abortSignal: params.signal,
          requestMetadata: params.requestMetadata,
          streamNodeOutput: params.onStreamEvent,
          getInboundValues: () => orderedInboundValues,
          setNodeOutput: (_nodeId, value) => {
            capturedOutput = value as SerializableValue;
          },
        };

        handlerResult = perfRunId
          ? ((await perfAsync(
              perfRunId,
              "node.handler.external",
              async () => runtimeHandler(graphNode, ctx),
              {
                nodeId: params.compiledNode.id,
                specId: params.compiledNode.specId,
                note: "includes_model_and_external_api",
              },
            )) as SerializableValue | null | undefined)
          : ((await runtimeHandler(graphNode, ctx)) as SerializableValue | null | undefined);
      }
      const rawOutput = perfRunId
        ? perfSync(
            perfRunId,
            "node.executor.resolveRawOutput",
            () =>
              capturedOutput ??
              (handlerResult === undefined ? null : (handlerResult as SerializableValue)),
            phaseMeta,
          )
        : (capturedOutput ??
          (handlerResult === undefined ? null : (handlerResult as SerializableValue)));
      const endedAt = new Date().toISOString();

      const buildOutputsByPort = (): Record<string, SerializableValue> | undefined => {
        if (
          params.compiledNode.specId === "condition" &&
          rawOutput &&
          typeof rawOutput === "object" &&
          !Array.isArray(rawOutput) &&
          CONDITION_RESULT_KEY in rawOutput
        ) {
          const conditionOutput = rawOutput as Record<string, SerializableValue>;
          const branchTaken = Boolean(conditionOutput[CONDITION_RESULT_KEY]);
          const selectedPortId = branchTaken ? "true" : "false";
          return {
            [selectedPortId]:
              (conditionOutput[CONDITION_PASSTHROUGH_KEY] as SerializableValue | undefined) ??
              rawOutput,
            [CONDITION_RESULT_KEY]: branchTaken,
          };
        }
        if (params.compiledNode.outputPorts.length === 0) {
          return { [RESULT_OUTPUT_PORT_ID]: rawOutput };
        }
        if (
          params.compiledNode.outputPorts.length > 1 &&
          rawOutput &&
          typeof rawOutput === "object" &&
          !Array.isArray(rawOutput)
        ) {
          const candidate = rawOutput as Record<string, SerializableValue>;
          return Object.fromEntries(
            params.compiledNode.outputPorts
              .filter((port) => candidate[port.id] !== undefined)
              .map((port) => [port.id, candidate[port.id] as SerializableValue]),
          );
        }
        const primaryOutputPortId = params.compiledNode.outputPorts[0]?.id ?? RESULT_OUTPUT_PORT_ID;
        return {
          [primaryOutputPortId]: rawOutput,
        };
      };

      const outputsByPort = perfRunId
        ? perfSync(perfRunId, "node.executor.buildOutputsByPort", buildOutputsByPort, phaseMeta)
        : buildOutputsByPort();

      return {
        status: "completed",
        outputsByPort,
        metrics: {
          startedAt,
          endedAt,
          durationMs: Date.now() - startedMs,
        },
      };
    } catch (error) {
      const endedAt = new Date().toISOString();
      const errorMessage =
        error instanceof Error ? error.message : "Unknown node execution failure";
      const isAbort =
        params.signal.aborted || (error instanceof Error && error.name === "AbortError");

      return {
        status: isAbort ? "cancelled" : "failed",
        error: {
          message: errorMessage,
          retryable: false,
        },
        metrics: {
          startedAt,
          endedAt,
          durationMs: Date.now() - startedMs,
        },
      };
    }
  }
}
