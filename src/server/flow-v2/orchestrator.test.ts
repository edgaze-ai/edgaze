import { describe, expect, it } from "vitest";

import type { CompiledWorkflowDefinition, PayloadReference, SerializableValue } from "./types";
import {
  buildInitialRunNodeRecords,
  buildRunInitializationEvents,
  WorkflowRunOrchestrator,
} from "./orchestrator";
import type { InitializeRunNodeRecord, WorkflowExecutionRepository } from "./repository";

const makePort = (id: string, kind: "input" | "output", label: string) => ({
  id,
  name: id,
  kind,
  valueType: "any" as const,
  label,
  required: false,
  multiplicity: "single" as const,
});

const makeBinding = (
  edgeId: string,
  targetNodeId: string,
  targetPortId: string,
  sourceNodeId: string,
  sourcePortId: string,
) => ({
  edgeId,
  targetNodeId,
  targetPortId,
  sourceNodeId,
  sourcePortId,
  sourceValueType: "any" as const,
  targetValueType: "any" as const,
  multiplicity: "single" as const,
  bindingOrderKey: `${targetNodeId}::${targetPortId}::${sourceNodeId}::${sourcePortId}::${edgeId}`,
});

const makeEdge = (
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
) => ({
  id,
  sourceNodeId,
  sourcePortId,
  targetNodeId,
  targetPortId,
  bindingOrderKey: `${targetNodeId}::${targetPortId}::${sourceNodeId}::${sourcePortId}::${id}`,
});

function makeCompiled(): CompiledWorkflowDefinition {
  return {
    workflowId: "wf_test",
    versionId: "version_test",
    snapshotHash: "hash_test",
    compiledAt: "2026-03-27T00:00:00.000Z",
    topoOrder: ["input_a", "chat_a", "output_a"],
    entryNodeIds: ["input_a"],
    terminalNodeIds: ["output_a"],
    dependencyMap: {
      input_a: [],
      chat_a: ["input_a"],
      output_a: ["chat_a"],
    },
    downstreamMap: {
      input_a: ["chat_a"],
      chat_a: ["output_a"],
      output_a: [],
    },
    edges: [
      makeEdge("edge_1", "input_a", "out-right", "chat_a", "in"),
      makeEdge("edge_2", "chat_a", "out", "output_a", "in-left"),
    ],
    nodes: [
      {
        id: "input_a",
        specId: "input",
        config: {},
        failurePolicy: "fail_fast",
        topoIndex: 0,
        inputPorts: [],
        outputPorts: [makePort("out-right", "output", "Data")],
        inputBindings: [],
        dependencyNodeIds: [],
        downstreamNodeIds: ["chat_a"],
        isEntryNode: true,
        isTerminalNode: false,
      },
      {
        id: "chat_a",
        specId: "llm-chat",
        config: { prompt: "Hello" },
        failurePolicy: "fail_fast",
        topoIndex: 1,
        inputPorts: [makePort("in", "input", "Input")],
        outputPorts: [makePort("out", "output", "Response")],
        inputBindings: [
          makeBinding("edge_1", "chat_a", "in", "input_a", "out-right"),
        ],
        dependencyNodeIds: ["input_a"],
        downstreamNodeIds: ["output_a"],
        isEntryNode: false,
        isTerminalNode: false,
      },
      {
        id: "output_a",
        specId: "output",
        config: {},
        failurePolicy: "fail_fast",
        topoIndex: 2,
        inputPorts: [makePort("in-left", "input", "Result")],
        outputPorts: [],
        inputBindings: [
          makeBinding("edge_2", "output_a", "in-left", "chat_a", "out"),
        ],
        dependencyNodeIds: ["chat_a"],
        downstreamNodeIds: [],
        isEntryNode: false,
        isTerminalNode: true,
      },
    ],
  };
}

class FakeRepository implements WorkflowExecutionRepository {
  frozen:
    | {
        runId: string;
        compiled: CompiledWorkflowDefinition;
        runInput: Record<string, SerializableValue>;
      }
    | null = null;
  initializedNodes: InitializeRunNodeRecord[] = [];
  events = [] as ReturnType<typeof buildRunInitializationEvents>;
  cancellationRequestedRunId: string | null = null;

  async freezeCompiledSnapshot(params: {
    runId: string;
    compiled: CompiledWorkflowDefinition;
    runInput: Record<string, SerializableValue>;
  }): Promise<void> {
    this.frozen = params;
  }

  async initializeRunNodes(params: {
    runId: string;
    nodes: InitializeRunNodeRecord[];
  }): Promise<void> {
    this.initializedNodes = params.nodes;
  }

  async appendRunEvents(params: { runId: string; events: ReturnType<typeof buildRunInitializationEvents> }): Promise<void> {
    this.events = params.events;
  }

  async markCancellationRequested(params: { runId: string }): Promise<void> {
    this.cancellationRequestedRunId = params.runId;
  }

  async appendRunEvent(): Promise<number> {
    return 1;
  }

  async appendRunEventsBatch(params: {
    runId: string;
    events: Array<{
      type: RunEvent["type"];
      payload: RunEvent["payload"];
      nodeId?: string;
      attemptNumber?: number;
      createdAt?: string;
    }>;
  }): Promise<number[]> {
    return params.events.map((_, index) => index + 1);
  }

  async claimNextRunnableNode() {
    return null;
  }
  async renewAttemptLease(): Promise<boolean> {
    return true;
  }

  async getRunState() {
    return {
      status: "queued" as const,
      cancelRequestedAt: null,
      compiled: makeCompiled(),
      lastEventSequence: 0,
    };
  }

  async listRunNodes() {
    return [];
  }

  async updateNodeStatuses() {
    return [];
  }

  async loadRunInput(): Promise<Record<string, SerializableValue>> {
    return {};
  }

  async loadUpstreamOutputs(): Promise<Record<string, SerializableValue | undefined>> {
    return {};
  }

  async persistAttemptMaterializedInput(): Promise<void> {}

  async persistAttemptResult(_: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    result: {
      status: "completed" | "failed" | "timed_out" | "cancelled";
      metrics?: { endedAt: string; durationMs: number };
    };
    inputPayload?: PayloadReference | null;
    outputPayload: PayloadReference | null;
    errorPayload: PayloadReference | null;
  }): Promise<void> {}

  async finalizeRun(): Promise<void> {}
}

describe("buildInitialRunNodeRecords", () => {
  it("marks entry nodes ready and all others pending", () => {
    const records = buildInitialRunNodeRecords(makeCompiled());

    expect(records).toEqual([
      expect.objectContaining({ nodeId: "input_a", status: "ready", topoIndex: 0 }),
      expect.objectContaining({ nodeId: "chat_a", status: "pending", topoIndex: 1 }),
      expect.objectContaining({ nodeId: "output_a", status: "pending", topoIndex: 2 }),
    ]);
  });
});

describe("buildRunInitializationEvents", () => {
  it("emits run.created followed by deterministic entry node ready events", () => {
    const events = buildRunInitializationEvents({
      runId: "run_test",
      compiled: makeCompiled(),
      workflowId: "wf_test",
    });

    expect(events.map((event) => event.type)).toEqual(["run.created", "node.ready"]);
    expect(events[0]?.sequence).toBe(1);
    expect(events[1]).toMatchObject({
      sequence: 2,
      type: "node.ready",
      payload: expect.objectContaining({ nodeId: "input_a", status: "ready" }),
    });
  });
});

describe("WorkflowRunOrchestrator", () => {
  it("freezes compiled snapshot, initializes nodes, and appends bootstrap events", async () => {
    const repository = new FakeRepository();
    const orchestrator = new WorkflowRunOrchestrator(repository);
    const compiled = makeCompiled();

    await orchestrator.initializeRun({
      runId: "run_test",
      compiled,
      runInput: { prompt: "hello" },
      workflowId: "wf_test",
    });

    expect(repository.frozen).toMatchObject({
      runId: "run_test",
      compiled,
      runInput: { prompt: "hello" },
    });
    expect(repository.initializedNodes).toHaveLength(3);
    expect(repository.events.map((event) => event.type)).toEqual(["run.created", "node.ready"]);
  });
});
