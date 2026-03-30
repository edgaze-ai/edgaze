import { describe, expect, it } from "vitest";

import { LegacyNodeExecutorAdapter } from "./node-executor";
import { materializeNodeInput } from "./materializer";
import { executeClaimedNode } from "./node-worker";
import { readPayloadReferenceValue } from "./payload-store";
import type {
  CompiledNode,
  NodeExecutionResult,
  PayloadReference,
  SerializableValue,
} from "./types";

function makeInputNode(): CompiledNode {
  return {
    id: "input_a",
    specId: "input",
    title: "Input A",
    config: { defaultValue: "fallback" },
    failurePolicy: "fail_fast",
    topoIndex: 0,
    inputPorts: [],
    outputPorts: [
      {
        id: "out-right",
        name: "out-right",
        kind: "output",
        label: "Data",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
    ],
    inputBindings: [],
    dependencyNodeIds: [],
    downstreamNodeIds: ["delay_a"],
    isEntryNode: true,
    isTerminalNode: false,
  };
}

function makeDelayNode(): CompiledNode {
  return {
    id: "delay_a",
    specId: "delay",
    title: "Delay A",
    config: { duration: 1000 },
    failurePolicy: "fail_fast",
    topoIndex: 1,
    inputPorts: [
      {
        id: "input",
        name: "input",
        kind: "input",
        label: "Input",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
    ],
    outputPorts: [
      {
        id: "output",
        name: "output",
        kind: "output",
        label: "Output",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
    ],
    inputBindings: [
      {
        edgeId: "edge_1",
        targetPortId: "input",
        targetNodeId: "delay_a",
        sourceNodeId: "input_a",
        sourcePortId: "out-right",
        sourceValueType: "any",
        targetValueType: "any",
        multiplicity: "single",
        bindingOrderKey: "delay_a::input::input_a::out-right::edge_1",
      },
    ],
    dependencyNodeIds: ["input_a"],
    downstreamNodeIds: [],
    isEntryNode: false,
    isTerminalNode: true,
  };
}

function makeMergeNode(): CompiledNode {
  return {
    id: "merge_a",
    specId: "merge",
    title: "Merge A",
    config: {},
    failurePolicy: "fail_fast",
    topoIndex: 1,
    inputPorts: [
      {
        id: "in-left",
        name: "in-left",
        kind: "input",
        label: "in-left",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
      {
        id: "in-top",
        name: "in-top",
        kind: "input",
        label: "in-top",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
    ],
    outputPorts: [
      {
        id: "out-right",
        name: "out-right",
        kind: "output",
        label: "Data",
        valueType: "any",
        required: false,
        multiplicity: "single",
      },
    ],
    inputBindings: [
      {
        edgeId: "edge_1",
        targetPortId: "in-left",
        targetNodeId: "merge_a",
        sourceNodeId: "input_left",
        sourcePortId: "out-right",
        sourceValueType: "any",
        targetValueType: "any",
        multiplicity: "single",
        bindingOrderKey: "merge_a::in-left::input_left::out-right::edge_1",
      },
      {
        edgeId: "edge_2",
        targetPortId: "in-top",
        targetNodeId: "merge_a",
        sourceNodeId: "input_top",
        sourcePortId: "out-right",
        sourceValueType: "any",
        targetValueType: "any",
        multiplicity: "single",
        bindingOrderKey: "merge_a::in-top::input_top::out-right::edge_2",
      },
    ],
    dependencyNodeIds: ["input_left", "input_top"],
    downstreamNodeIds: [],
    isEntryNode: false,
    isTerminalNode: true,
  };
}

describe("materializeNodeInput", () => {
  it("materializes entry node values from run input explicitly", () => {
    const input = materializeNodeInput({
      runId: "run_test",
      attemptNumber: 1,
      compiledNode: makeInputNode(),
      runInput: { input_a: "hello world" },
      upstreamOutputsByNodeId: {},
    });

    expect(input.ports.__input__?.value).toEqual("hello world");
    expect(input.ports.__input__?.sources).toEqual([
      {
        edgeId: "__entry__",
        targetPortId: "__input__",
        sourceNodeId: "__run_input__",
        sourcePortId: "__run_input__",
        value: "hello world",
      },
    ]);
  });

  it("materializes explicit upstream bindings by target port", () => {
    const input = materializeNodeInput({
      runId: "run_test",
      attemptNumber: 2,
      compiledNode: makeDelayNode(),
      runInput: {},
      upstreamOutputsByNodeId: {
        input_a: "payload from upstream",
      },
    });

    expect(input.ports.input?.value).toEqual("payload from upstream");
    expect(input.ports.input?.sources[0]).toMatchObject({
      edgeId: "edge_1",
      targetPortId: "input",
      sourceNodeId: "input_a",
      sourcePortId: "out-right",
      value: "payload from upstream",
    });
  });
});

class FakeWorkerRepository {
  materializedInputPayload: PayloadReference | null = null;
  resultPayloads:
    | {
        result: NodeExecutionResult;
        outputPayload: PayloadReference | null;
        errorPayload: PayloadReference | null;
      }
    | null = null;

  constructor(
    private readonly runInput: Record<string, SerializableValue>,
    private readonly upstreamOutputs: Record<string, PayloadReference | SerializableValue | undefined>,
  ) {}

  async loadRunInput(): Promise<Record<string, SerializableValue>> {
    return this.runInput;
  }

  async loadUpstreamOutputs(): Promise<
    Record<string, PayloadReference | SerializableValue | undefined>
  > {
    return this.upstreamOutputs;
  }

  async persistAttemptMaterializedInput(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    inputPayload: PayloadReference;
  }): Promise<void> {
    this.materializedInputPayload = params.inputPayload;
  }

  async persistAttemptResult(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    result: NodeExecutionResult;
    outputPayload: PayloadReference | null;
    errorPayload: PayloadReference | null;
  }): Promise<void> {
    this.resultPayloads = {
      result: params.result,
      outputPayload: params.outputPayload,
      errorPayload: params.errorPayload,
    };
  }
}

describe("executeClaimedNode", () => {
  it("persists materialized input before storing result payloads", async () => {
    const repository = new FakeWorkerRepository(
      { input_a: "hello world" },
      {
        input_a: "hello world",
      },
    );

    const result = await executeClaimedNode({
      workItem: {
        runId: "run_test",
        runNodeId: "run_node_test",
        attemptId: "attempt_test",
        attemptNumber: 1,
        leaseOwner: "worker_test",
        leaseExpiresAt: null,
        compiledNode: makeInputNode(),
      },
      repository,
      executor: new LegacyNodeExecutorAdapter(),
      signal: new AbortController().signal,
    });

    expect(result.status).toBe("completed");
    expect(repository.materializedInputPayload).not.toBeNull();
    expect(repository.resultPayloads?.outputPayload).not.toBeNull();
    expect(readPayloadReferenceValue(repository.resultPayloads?.outputPayload ?? undefined)).toEqual(
      { "out-right": "hello world" },
    );
    expect(readPayloadReferenceValue(repository.materializedInputPayload ?? undefined)).toMatchObject({
      compact: true,
      ports: {
        __input__: {
          value: "hello world",
          sourceCount: 1,
        },
      },
    });
  });

  it("cancels delay execution through the propagated abort signal", async () => {
    const repository = new FakeWorkerRepository(
      {},
      {
        input_a: "payload from upstream",
      },
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("Cancelled by worker")), 20);

    const result = await executeClaimedNode({
      workItem: {
        runId: "run_test",
        runNodeId: "run_node_delay",
        attemptId: "attempt_delay",
        attemptNumber: 1,
        leaseOwner: "worker_test",
        leaseExpiresAt: null,
        compiledNode: makeDelayNode(),
      },
      repository,
      executor: new LegacyNodeExecutorAdapter(),
      signal: controller.signal,
    });

    expect(result.status).toBe("cancelled");
    expect(repository.resultPayloads?.errorPayload).not.toBeNull();
  });

  it("fast-path executes merge nodes while storing compact resolved input", async () => {
    const repository = new FakeWorkerRepository(
      {},
      {
        input_left: "Hello",
        input_top: "World",
      },
    );

    const result = await executeClaimedNode({
      workItem: {
        runId: "run_test",
        runNodeId: "run_node_merge",
        attemptId: "attempt_merge",
        attemptNumber: 1,
        leaseOwner: "worker_test",
        leaseExpiresAt: null,
        compiledNode: makeMergeNode(),
      },
      repository,
      executor: new LegacyNodeExecutorAdapter(),
      signal: new AbortController().signal,
    });

    expect(result.status).toBe("completed");
    expect(readPayloadReferenceValue(repository.resultPayloads?.outputPayload ?? undefined)).toEqual({
      "out-right": "Hello\n\nWorld",
    });
    expect(readPayloadReferenceValue(repository.materializedInputPayload ?? undefined)).toMatchObject({
      compact: true,
      ports: {
        "in-left": {
          value: "Hello",
          sourceCount: 1,
        },
        "in-top": {
          value: "World",
          sourceCount: 1,
        },
      },
    });
  });
});
