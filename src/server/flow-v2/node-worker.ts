import { perfAsync, perfSync } from "./engine-perf";
import { createInlinePayloadReference } from "./payload-store";
import { materializeNodeInput } from "./materializer";
import type {
  ClaimedNodeWorkItem,
  NodeExecutionResult,
  PayloadReference,
  SerializableValue,
} from "./types";
import type { NodeExecutor } from "./node-executor";

const FAST_LOCAL_SNAPSHOT_SPEC_IDS = new Set(["input", "merge", "output"]);
const FAST_LOCAL_INPUT_ONLY_SPEC_IDS = new Set(["input"]);
const FAST_LOCAL_UPSTREAM_ONLY_SPEC_IDS = new Set(["merge", "output"]);

function payloadSizeBucket(byteLength: number | null | undefined): string {
  if (!byteLength || byteLength <= 0) return "empty";
  if (byteLength < 1_024) return "<1kb";
  if (byteLength < 10_240) return "1kb-10kb";
  if (byteLength < 102_400) return "10kb-100kb";
  if (byteLength < 1_048_576) return "100kb-1mb";
  return ">=1mb";
}

function buildPersistedMaterializedInputSnapshot(params: {
  specId: string;
  materializedInput: {
    runId: string;
    nodeId: string;
    specId: string;
    attemptNumber: number;
    config: Record<string, SerializableValue>;
    ports: Record<
      string,
      {
        targetPortId: string;
        multiplicity: string;
        valueType: string;
        value: SerializableValue;
        sources: Array<{
          sourceNodeId: string;
          sourcePortId: string;
          objectEntryKey?: string;
        }>;
      }
    >;
  };
}): SerializableValue {
  if (!FAST_LOCAL_SNAPSHOT_SPEC_IDS.has(params.specId)) {
    return {
      runId: params.materializedInput.runId,
      nodeId: params.materializedInput.nodeId,
      specId: params.materializedInput.specId,
      attemptNumber: params.materializedInput.attemptNumber,
      config: params.materializedInput.config,
      ports: Object.fromEntries(
        Object.entries(params.materializedInput.ports).map(([portId, port]) => [
          portId,
          {
            targetPortId: port.targetPortId,
            multiplicity: port.multiplicity,
            valueType: port.valueType,
            value: port.value,
            sources: port.sources.map((source) => ({
              sourceNodeId: source.sourceNodeId,
              sourcePortId: source.sourcePortId,
              objectEntryKey: source.objectEntryKey ?? null,
              value:
                "value" in source
                  ? ((source as unknown as { value: SerializableValue }).value ?? null)
                  : null,
            })),
          },
        ]),
      ),
    };
  }

  return {
    runId: params.materializedInput.runId,
    nodeId: params.materializedInput.nodeId,
    specId: params.materializedInput.specId,
    attemptNumber: params.materializedInput.attemptNumber,
    config: params.materializedInput.config,
    compact: true,
    ports: Object.fromEntries(
      Object.entries(params.materializedInput.ports).map(([portId, port]) => [
        portId,
        {
          targetPortId: port.targetPortId,
          multiplicity: port.multiplicity,
          valueType: port.valueType,
          value: port.value,
          sourceCount: port.sources.length,
          sourceNodeIds: Array.from(new Set(port.sources.map((source) => source.sourceNodeId))),
          sourcePortIds: Array.from(new Set(port.sources.map((source) => source.sourcePortId))),
        },
      ]),
    ),
  };
}

export interface WorkflowNodeWorkerRepository {
  loadRunInput(runId: string): Promise<Record<string, SerializableValue>>;
  loadUpstreamOutputs(params: {
    runId: string;
    sourceNodeIds: string[];
  }): Promise<Record<string, PayloadReference | SerializableValue | undefined>>;
  persistAttemptMaterializedInput(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    inputPayload: PayloadReference;
  }): Promise<void>;
  persistAttemptResult(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    result: NodeExecutionResult;
    inputPayload?: PayloadReference | null;
    outputPayload: PayloadReference | null;
    errorPayload: PayloadReference | null;
  }): Promise<void>;
  appendRunEvent?(params: {
    runId: string;
    type: string;
    nodeId?: string;
    attemptNumber?: number;
    payload: Record<string, SerializableValue>;
    createdAt?: string;
  }): Promise<number>;
}

export interface ExecuteClaimedNodeParams {
  workItem: ClaimedNodeWorkItem;
  repository: WorkflowNodeWorkerRepository;
  executor: NodeExecutor;
  signal: AbortSignal;
  requestMetadata?: {
    userId?: string | null;
    identifier?: string;
    identifierType?: "ip" | "device" | "user";
    workflowId?: string;
  };
}

export async function executeClaimedNode(
  params: ExecuteClaimedNodeParams,
): Promise<NodeExecutionResult> {
  const runId = params.workItem.runId;
  const specId = params.workItem.compiledNode.specId;
  const isFastLocalNode = FAST_LOCAL_SNAPSHOT_SPEC_IDS.has(specId);
  const phaseMeta = {
    nodeId: params.workItem.compiledNode.id,
    attemptNumber: params.workItem.attemptNumber,
    specId,
  };

  const runInput = FAST_LOCAL_UPSTREAM_ONLY_SPEC_IDS.has(specId)
    ? {}
    : await perfAsync(
        runId,
        "node.loadRunInput",
        () => params.repository.loadRunInput(params.workItem.runId),
        phaseMeta,
      );
  const upstreamOutputs =
    FAST_LOCAL_INPUT_ONLY_SPEC_IDS.has(specId) ||
    params.workItem.compiledNode.dependencyNodeIds.length === 0
      ? {}
      : await perfAsync(
          runId,
          "node.loadUpstreamOutputs",
          () =>
            params.repository.loadUpstreamOutputs({
              runId: params.workItem.runId,
              sourceNodeIds: params.workItem.compiledNode.dependencyNodeIds,
            }),
          {
            ...phaseMeta,
            dependencyCount: params.workItem.compiledNode.dependencyNodeIds.length,
          },
        );

  const materializedInput = perfSync(
    runId,
    "node.materializeNodeInput",
    () =>
      materializeNodeInput({
        runId: params.workItem.runId,
        attemptNumber: params.workItem.attemptNumber,
        compiledNode: params.workItem.compiledNode,
        runInput,
        upstreamOutputsByNodeId: upstreamOutputs,
      }),
    {
      ...phaseMeta,
      inputPortCount: params.workItem.compiledNode.inputPorts.length,
      bindingCount: params.workItem.compiledNode.inputBindings.length,
    },
  );

  const inputPayloadRef = perfSync(
    runId,
    "serialization.inlinePayload.input",
    () =>
      createInlinePayloadReference(
        buildPersistedMaterializedInputSnapshot({
          specId: params.workItem.compiledNode.specId,
          materializedInput,
        }),
      ),
    phaseMeta,
  );

  const inputPayloadMeta = {
    ...phaseMeta,
    payloadBytes: inputPayloadRef.byteLength ?? 0,
    payloadSizeBucket: payloadSizeBucket(inputPayloadRef.byteLength),
  };

  if (!isFastLocalNode) {
    await perfAsync(
      runId,
      "node.persistAttemptMaterializedInput",
      () =>
        params.repository.persistAttemptMaterializedInput({
          attemptId: params.workItem.attemptId,
          runNodeId: params.workItem.runNodeId,
          attemptNumber: params.workItem.attemptNumber,
          leaseOwner: params.workItem.leaseOwner,
          inputPayload: inputPayloadRef,
        }),
      inputPayloadMeta,
    );

    await perfAsync(
      runId,
      "node.streamEmit.node_materialized_input",
      async () => {
        if (params.repository.appendRunEvent) {
          await params.repository.appendRunEvent({
            runId: params.workItem.runId,
            type: "node_materialized_input",
            nodeId: params.workItem.compiledNode.id,
            attemptNumber: params.workItem.attemptNumber,
            payload: {
              nodeId: params.workItem.compiledNode.id,
              attemptNumber: params.workItem.attemptNumber,
              specId,
              status: "running",
              message: "Node input materialized and frozen for this attempt.",
              inputBytes: inputPayloadRef.byteLength ?? 0,
              inputSizeBucket: payloadSizeBucket(inputPayloadRef.byteLength),
            },
          });
        }
      },
      phaseMeta,
    );
  }

  let streamStarted = false;
  let streamFinished = false;
  let streamBuffer = "";
  let fullStreamText = "";
  let lastStreamFlushAt = 0;
  const streamFormat: "plain" | "markdown" = "markdown";
  let streamChunkIndex = 0;

  const flushStreamDelta = async (force = false) => {
    if (!params.repository.appendRunEvent || streamBuffer.length === 0) return;
    const now = Date.now();
    if (!force && now - lastStreamFlushAt < 80) return;

    const delta = streamBuffer;
    streamBuffer = "";
    lastStreamFlushAt = now;
    streamChunkIndex += 1;
    await perfAsync(
      runId,
      "node.streamEmit.delta",
      () =>
        params.repository.appendRunEvent!({
          runId: params.workItem.runId,
          type: "node.stream.delta",
          nodeId: params.workItem.compiledNode.id,
          attemptNumber: params.workItem.attemptNumber,
          payload: {
            nodeId: params.workItem.compiledNode.id,
            attemptNumber: params.workItem.attemptNumber,
            specId,
            status: "running",
            delta,
            format: streamFormat,
            streamChunkIndex,
            totalStreamedChars: fullStreamText.length,
          },
        }),
      {
        ...phaseMeta,
        deltaChars: delta.length,
      },
    );
  };

  const result = await params.executor.execute({
    compiledNode: params.workItem.compiledNode,
    materializedInput,
    runInput,
    signal: params.signal,
    requestMetadata: params.requestMetadata,
    perfRunId: runId,
    onStreamEvent: async (nodeId, payload) => {
      if (!params.repository.appendRunEvent || nodeId !== params.workItem.compiledNode.id) return;

      if (!streamStarted || payload.status === "started") {
        streamStarted = true;
        await perfAsync(
          runId,
          "node.streamEmit.started",
          () =>
            params.repository.appendRunEvent!({
              runId: params.workItem.runId,
              type: "node.stream.started",
              nodeId,
              attemptNumber: params.workItem.attemptNumber,
              payload: {
                nodeId,
                attemptNumber: params.workItem.attemptNumber,
                specId,
                status: "running",
                format: payload.format ?? streamFormat,
              },
            }),
          phaseMeta,
        );
      }

      if (typeof payload.delta === "string" && payload.delta.length > 0) {
        streamBuffer += payload.delta;
        fullStreamText += payload.delta;
        await flushStreamDelta(false);
      }

      if (payload.status === "finished" || payload.status === "interrupted") {
        await flushStreamDelta(true);
        streamFinished = true;
        await perfAsync(
          runId,
          "node.streamEmit.finished",
          () =>
            params.repository.appendRunEvent!({
              runId: params.workItem.runId,
              type: "node.stream.finished",
              nodeId,
              attemptNumber: params.workItem.attemptNumber,
              payload: {
                nodeId,
                attemptNumber: params.workItem.attemptNumber,
                specId,
                status: payload.status === "interrupted" ? "cancelled" : "completed",
                text: typeof payload.text === "string" ? payload.text : fullStreamText,
                format: payload.format ?? streamFormat,
                error: payload.error ?? null,
                totalStreamedChars: fullStreamText.length,
              },
            }),
          {
            ...phaseMeta,
            streamedChars: fullStreamText.length,
          },
        );
      }
    },
  });

  if (streamStarted && !streamFinished && params.repository.appendRunEvent) {
    await flushStreamDelta(true);
    await perfAsync(
      runId,
      "node.streamEmit.finished_fallback",
      () =>
        params.repository.appendRunEvent!({
          runId: params.workItem.runId,
          type: "node.stream.finished",
          nodeId: params.workItem.compiledNode.id,
          attemptNumber: params.workItem.attemptNumber,
          payload: {
            nodeId: params.workItem.compiledNode.id,
            attemptNumber: params.workItem.attemptNumber,
            specId,
            status:
              result.status === "completed"
                ? "completed"
                : result.status === "cancelled"
                  ? "cancelled"
                  : "failed",
            text: fullStreamText,
            format: streamFormat,
            error: result.error?.message ?? null,
            totalStreamedChars: fullStreamText.length,
          },
        }),
      {
        ...phaseMeta,
        streamedChars: fullStreamText.length,
      },
    );
  }

  const outputPayload = perfSync(
    runId,
    "serialization.inlinePayload.output",
    () =>
      result.outputsByPort === undefined
        ? null
        : createInlinePayloadReference(result.outputsByPort),
    phaseMeta,
  );
  const errorPayload = perfSync(
    runId,
    "serialization.inlinePayload.error",
    () =>
      result.error === undefined
        ? null
        : createInlinePayloadReference({
            message: result.error.message,
            code: result.error.code ?? null,
            details: result.error.details ?? null,
            retryable: result.error.retryable,
          }),
    phaseMeta,
  );

  await perfAsync(
    runId,
    "node.persistAttemptResult",
    () =>
      params.repository.persistAttemptResult({
        attemptId: params.workItem.attemptId,
        runNodeId: params.workItem.runNodeId,
        attemptNumber: params.workItem.attemptNumber,
        leaseOwner: params.workItem.leaseOwner,
        result,
        inputPayload: isFastLocalNode ? inputPayloadRef : null,
        outputPayload,
        errorPayload,
      }),
    {
      ...phaseMeta,
      outputPayloadBytes: outputPayload?.byteLength ?? 0,
      outputPayloadSizeBucket: payloadSizeBucket(outputPayload?.byteLength),
      errorPayloadBytes: errorPayload?.byteLength ?? 0,
      errorPayloadSizeBucket: payloadSizeBucket(errorPayload?.byteLength),
    },
  );

  return result;
}
