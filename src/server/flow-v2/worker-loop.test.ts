import { describe, expect, it } from "vitest";

import { LegacyNodeExecutorAdapter, type NodeExecutor } from "./node-executor";
import { createInlinePayloadReference } from "./payload-store";
import type {
  ClaimedNodeWorkItem,
  CompiledNode,
  CompiledWorkflowDefinition,
  PayloadReference,
  RunEvent,
  SerializableValue,
  WorkflowOutcome,
  WorkflowRunNode,
  WorkflowRunNodeAttemptStatus,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from "./types";
import { processNextRunnableBatch, processNextRunNode } from "./worker-loop";
import type { WorkflowExecutionRepository } from "./repository";

const makePort = (id: string, kind: "input" | "output", label: string) => ({
  id,
  name: id,
  kind,
  label,
  valueType: "any" as const,
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
    topoOrder: ["input_a", "delay_a", "output_a"],
    entryNodeIds: ["input_a"],
    terminalNodeIds: ["output_a"],
    dependencyMap: {
      input_a: [],
      delay_a: ["input_a"],
      output_a: ["delay_a"],
    },
    downstreamMap: {
      input_a: ["delay_a"],
      delay_a: ["output_a"],
      output_a: [],
    },
    edges: [
      makeEdge("edge_1", "input_a", "out-right", "delay_a", "input"),
      makeEdge("edge_2", "delay_a", "output", "output_a", "in-left"),
    ],
    nodes: [
      {
        id: "input_a",
        specId: "input",
        title: "Input A",
        config: {},
        failurePolicy: "fail_fast",
        topoIndex: 0,
        inputPorts: [],
        outputPorts: [makePort("out-right", "output", "Data")],
        inputBindings: [],
        dependencyNodeIds: [],
        downstreamNodeIds: ["delay_a"],
        isEntryNode: true,
        isTerminalNode: false,
      },
      {
        id: "delay_a",
        specId: "delay",
        title: "Delay A",
        config: { duration: 0 },
        failurePolicy: "fail_fast",
        topoIndex: 1,
        inputPorts: [makePort("input", "input", "Input")],
        outputPorts: [makePort("output", "output", "Output")],
        inputBindings: [
          makeBinding("edge_1", "delay_a", "input", "input_a", "out-right"),
        ],
        dependencyNodeIds: ["input_a"],
        downstreamNodeIds: ["output_a"],
        isEntryNode: false,
        isTerminalNode: false,
      },
      {
        id: "output_a",
        specId: "output",
        title: "Output A",
        config: {},
        failurePolicy: "fail_fast",
        topoIndex: 2,
        inputPorts: [makePort("in-left", "input", "Result")],
        outputPorts: [],
        inputBindings: [
          makeBinding("edge_2", "output_a", "in-left", "delay_a", "output"),
        ],
        dependencyNodeIds: ["delay_a"],
        downstreamNodeIds: [],
        isEntryNode: false,
        isTerminalNode: true,
      },
    ],
  };
}

function makeRunNode(
  compiledNode: CompiledNode,
  status: WorkflowRunNodeStatus,
  outputPayload: PayloadReference | null = null,
): WorkflowRunNode {
  return {
    id: `run_node_${compiledNode.id}`,
    runId: "run_test",
    nodeId: compiledNode.id,
    specId: compiledNode.specId,
    topoIndex: compiledNode.topoIndex,
    status,
    failurePolicy: compiledNode.failurePolicy,
    latestAttemptNumber: 0,
    inputPayload: null,
    outputPayload,
    errorPayload: null,
    queuedAt: null,
    startedAt: null,
    endedAt: null,
    terminalAttemptId: null,
    isTerminalNode: compiledNode.isTerminalNode,
  };
}

class FakeExecutionRepository implements WorkflowExecutionRepository {
  readonly compiled: CompiledWorkflowDefinition;
  readonly events: Array<{ sequence: number; type: RunEvent["type"]; payload: RunEvent["payload"] }> = [];
  finalized:
    | { status: string; outcome: WorkflowOutcome; finalOutput: PayloadReference | null | undefined }
    | null = null;
  private eventSequence = 0;
  private attemptCounter = 0;
  private runStatus: WorkflowRunStatus = "running";

  constructor(
    private readonly runInput: Record<string, SerializableValue>,
    private readonly nodes: WorkflowRunNode[],
    compiled: CompiledWorkflowDefinition = makeCompiled(),
  ) {
    this.compiled = compiled;
  }

  async freezeCompiledSnapshot(): Promise<void> {}
  async initializeRunNodes(): Promise<void> {}
  async appendRunEvents(params: { runId: string; events: RunEvent[] }): Promise<void> {
    for (const event of params.events) {
      this.events.push({ sequence: event.sequence, type: event.type, payload: event.payload });
      this.eventSequence = Math.max(this.eventSequence, event.sequence);
    }
  }
  async appendRunEvent(params: {
    runId: string;
    type: RunEvent["type"];
    payload: RunEvent["payload"];
  }): Promise<number> {
    this.eventSequence += 1;
    this.events.push({ sequence: this.eventSequence, type: params.type, payload: params.payload });
    return this.eventSequence;
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
    const sequences: number[] = [];
    for (const event of params.events) {
      sequences.push(
        await this.appendRunEvent({
          runId: params.runId,
          type: event.type,
          payload: event.payload,
        }),
      );
    }
    return sequences;
  }
  async markCancellationRequested(): Promise<void> {
    this.runStatus = "cancelling";
  }
  async claimNextRunnableNode(): Promise<ClaimedNodeWorkItem | null> {
    const nextNode = this.nodes
      .filter((node) => node.status === "ready")
      .sort((left, right) => left.topoIndex - right.topoIndex)[0];

    if (!nextNode) return null;

    nextNode.status = "running";
    nextNode.startedAt = new Date().toISOString();
    nextNode.latestAttemptNumber += 1;
    this.attemptCounter += 1;

    const compiledNode = this.compiled.nodes.find((node) => node.id === nextNode.nodeId);
    if (!compiledNode) return null;

    return {
      runId: nextNode.runId,
      runNodeId: nextNode.id,
      attemptId: `attempt_${this.attemptCounter}`,
      attemptNumber: nextNode.latestAttemptNumber,
      leaseOwner: "worker_test",
      leaseExpiresAt: null,
      compiledNode,
    };
  }
  async renewAttemptLease(): Promise<boolean> {
    return true;
  }
  async getRunState(_: { runId: string }) {
    return {
      status: this.runStatus,
      cancelRequestedAt: this.runStatus === "cancelling" ? new Date().toISOString() : null,
      compiled: this.compiled,
      lastEventSequence: this.eventSequence,
    };
  }
  async listRunNodes(_: string): Promise<WorkflowRunNode[]> {
    return this.nodes.map((node) => ({ ...node }));
  }
  async updateNodeStatuses(params: {
    runId: string;
    nodeIds: string[];
    status: WorkflowRunNodeStatus;
    onlyCurrentStatuses?: WorkflowRunNodeStatus[];
    queuedAt?: string | null;
    endedAt?: string | null;
  }): Promise<string[]> {
    const changed: string[] = [];
    for (const node of this.nodes) {
      if (!params.nodeIds.includes(node.nodeId)) continue;
      if (params.onlyCurrentStatuses && !params.onlyCurrentStatuses.includes(node.status)) continue;
      node.status = params.status;
      if (params.queuedAt !== undefined) node.queuedAt = params.queuedAt;
      if (params.endedAt !== undefined) node.endedAt = params.endedAt;
      changed.push(node.nodeId);
    }
    return changed;
  }
  async loadRunInput(): Promise<Record<string, SerializableValue>> {
    return this.runInput;
  }
  async loadUpstreamOutputs(params: {
    runId: string;
    sourceNodeIds: string[];
  }): Promise<Record<string, PayloadReference | SerializableValue | undefined>> {
    const outputs: Record<string, PayloadReference | SerializableValue | undefined> = {};
    for (const nodeId of params.sourceNodeIds) {
      const node = this.nodes.find((candidate) => candidate.nodeId === nodeId);
      outputs[nodeId] = node?.outputPayload ?? undefined;
    }
    return outputs;
  }
  async persistAttemptMaterializedInput(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    inputPayload: PayloadReference;
  }): Promise<void> {
    const node = this.nodes.find((candidate) => candidate.id === params.runNodeId);
    if (node) node.inputPayload = params.inputPayload;
  }
  async persistAttemptResult(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    result: {
      status: WorkflowRunNodeAttemptStatus | "completed" | "failed" | "timed_out" | "cancelled";
      metrics?: { endedAt: string; durationMs: number };
    };
    inputPayload?: PayloadReference | null;
    outputPayload: PayloadReference | null;
    errorPayload: PayloadReference | null;
  }): Promise<void> {
    const node = this.nodes.find((candidate) => candidate.id === params.runNodeId);
    if (!node) return;
    node.status =
      params.result.status === "completed"
        ? "completed"
        : params.result.status === "cancelled"
          ? "cancelled"
          : params.result.status === "timed_out"
            ? "timed_out"
            : "failed";
    node.inputPayload = params.inputPayload ?? node.inputPayload;
    node.outputPayload = params.outputPayload;
    node.errorPayload = params.errorPayload;
    node.endedAt = params.result.metrics?.endedAt ?? new Date().toISOString();
    node.terminalAttemptId = params.attemptId;
  }
  async finalizeRun(params: {
    runId: string;
    status: "completed" | "failed" | "cancelled";
    outcome: WorkflowOutcome;
    finalOutput?: PayloadReference | null;
  }): Promise<void> {
    this.runStatus = params.status;
    this.finalized = {
      status: params.status,
      outcome: params.outcome,
      finalOutput: params.finalOutput,
    };
  }
}

function makeTwoIndependentInputsCompiled(): CompiledWorkflowDefinition {
  const outPort = makePort("out", "output", "Data");
  const inputNode = (id: string): CompiledNode => ({
    id,
    specId: "input",
    title: id,
    config: {},
    failurePolicy: "fail_fast",
    topoIndex: 0,
    inputPorts: [],
    outputPorts: [outPort],
    inputBindings: [],
    dependencyNodeIds: [],
    downstreamNodeIds: [],
    isEntryNode: true,
    isTerminalNode: true,
  });
  return {
    workflowId: "wf_parallel_inputs",
    versionId: "v1",
    snapshotHash: "hash_parallel",
    compiledAt: "2026-03-29T00:00:00.000Z",
    topoOrder: ["in1", "in2"],
    entryNodeIds: ["in1", "in2"],
    terminalNodeIds: ["in1", "in2"],
    dependencyMap: { in1: [], in2: [] },
    downstreamMap: { in1: [], in2: [] },
    edges: [],
    nodes: [inputNode("in1"), inputNode("in2")],
  };
}

class ConcurrencyTrackingExecutor implements NodeExecutor {
  active = 0;
  maxActive = 0;

  async execute(params: {
    compiledNode: CompiledNode;
    materializedInput: unknown;
    runInput: Record<string, SerializableValue>;
    signal: AbortSignal;
  }) {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 45);
    });
    this.active -= 1;
    return {
      status: "completed" as const,
      outputsByPort: { out: params.runInput[params.compiledNode.id] ?? null },
      metrics: {
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 45,
      },
    };
  }
}

class StaticResultExecutor implements NodeExecutor {
  constructor(
    private readonly results: Record<
      string,
      {
        status: "completed" | "failed";
        output?: SerializableValue;
        outputsByPort?: Record<string, SerializableValue>;
        message?: string;
      }
    >,
  ) {}

  async execute(params: {
    compiledNode: CompiledNode;
    materializedInput: unknown;
    runInput: Record<string, SerializableValue>;
    signal: AbortSignal;
  }) {
    const result = this.results[params.compiledNode.id];
    if (!result || result.status === "completed") {
      return {
        status: "completed" as const,
        outputsByPort:
          result?.outputsByPort ??
          (params.compiledNode.specId === "input"
            ? { [params.compiledNode.outputPorts[0]?.id ?? "out-right"]: params.runInput[params.compiledNode.id] ?? null }
            : result?.output !== undefined
              ? { [params.compiledNode.outputPorts[0]?.id ?? "out"]: result.output }
              : undefined),
        metrics: {
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: 1,
        },
      };
    }

    return {
      status: "failed" as const,
      error: {
        message: result.message ?? "failed",
        retryable: false,
      },
      metrics: {
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1,
      },
    };
  }
}

describe("processNextRunNode", () => {
  it("processes a ready node and marks downstream nodes ready deterministically", async () => {
    const compiled = makeCompiled();
    const repository = new FakeExecutionRepository(
      { input_a: "hello world" },
      [
        makeRunNode(compiled.nodes[0]!, "ready"),
        makeRunNode(compiled.nodes[1]!, "pending"),
        makeRunNode(compiled.nodes[2]!, "pending"),
      ],
    );

    const state = await processNextRunNode({
      runId: "run_test",
      signal: new AbortController().signal,
      dependencies: {
        repository,
        executor: new LegacyNodeExecutorAdapter(),
        workerId: "worker_test",
      },
    });

    expect(state).toMatchObject({ state: "processed", processed: true });
    const nodes = await repository.listRunNodes("run_test");
    expect(nodes.find((node) => node.nodeId === "input_a")?.status).toBe("completed");
    expect(nodes.find((node) => node.nodeId === "delay_a")?.status).toBe("ready");
    expect(repository.events.map((event) => event.type)).toContain("node.ready");
  });

  it("finalizes the run as failed when fail_fast leaves no terminal output", async () => {
    const compiled = makeCompiled();
    const repository = new FakeExecutionRepository(
      {},
      [
        makeRunNode(compiled.nodes[0]!, "completed", createInlinePayloadReference("input payload")),
        makeRunNode(compiled.nodes[1]!, "ready"),
        makeRunNode(compiled.nodes[2]!, "pending"),
      ],
    );

    const state = await processNextRunNode({
      runId: "run_test",
      signal: new AbortController().signal,
      dependencies: {
        repository,
        executor: new StaticResultExecutor({
          delay_a: { status: "failed", message: "boom" },
        }),
        workerId: "worker_test",
      },
    });

    expect(state).toMatchObject({ state: "finalized", processed: true });
    expect(repository.finalized).toMatchObject({
      status: "failed",
      outcome: "failed",
    });
    const nodes = await repository.listRunNodes("run_test");
    expect(nodes.find((node) => node.nodeId === "output_a")?.status).toBe("skipped");
  });

  it("marks the untaken condition branch immediately after the condition resolves", async () => {
    const compiled: CompiledWorkflowDefinition = {
      workflowId: "wf_condition",
      versionId: "version_condition",
      snapshotHash: "hash_condition",
      compiledAt: "2026-03-27T00:00:00.000Z",
      topoOrder: ["condition_a", "true_a", "false_a"],
      entryNodeIds: ["condition_a"],
      terminalNodeIds: ["true_a", "false_a"],
      dependencyMap: {
        condition_a: [],
        true_a: ["condition_a"],
        false_a: ["condition_a"],
      },
      downstreamMap: {
        condition_a: ["true_a", "false_a"],
        true_a: [],
        false_a: [],
      },
      edges: [
        makeEdge("edge_true", "condition_a", "true", "true_a", "input"),
        makeEdge("edge_false", "condition_a", "false", "false_a", "input"),
      ],
      nodes: [
        {
          id: "condition_a",
          specId: "condition",
          title: "Condition",
          config: {},
          failurePolicy: "fail_fast",
          topoIndex: 0,
          inputPorts: [makePort("input", "input", "Value")],
          outputPorts: [makePort("true", "output", "True"), makePort("false", "output", "False")],
          inputBindings: [],
          dependencyNodeIds: [],
          downstreamNodeIds: ["true_a", "false_a"],
          isEntryNode: true,
          isTerminalNode: false,
        },
        {
          id: "true_a",
          specId: "output",
          title: "True branch",
          config: {},
          failurePolicy: "fail_fast",
          topoIndex: 1,
          inputPorts: [makePort("input", "input", "Input")],
          outputPorts: [],
          inputBindings: [makeBinding("edge_true", "true_a", "input", "condition_a", "true")],
          dependencyNodeIds: ["condition_a"],
          downstreamNodeIds: [],
          isEntryNode: false,
          isTerminalNode: true,
        },
        {
          id: "false_a",
          specId: "output",
          title: "False branch",
          config: {},
          failurePolicy: "fail_fast",
          topoIndex: 2,
          inputPorts: [makePort("input", "input", "Input")],
          outputPorts: [],
          inputBindings: [makeBinding("edge_false", "false_a", "input", "condition_a", "false")],
          dependencyNodeIds: ["condition_a"],
          downstreamNodeIds: [],
          isEntryNode: false,
          isTerminalNode: true,
        },
      ],
    };

    const repository = new FakeExecutionRepository(
      {},
      [
        makeRunNode(compiled.nodes[0]!, "ready"),
        makeRunNode(compiled.nodes[1]!, "pending"),
        makeRunNode(compiled.nodes[2]!, "pending"),
      ],
      compiled,
    );

    const state = await processNextRunNode({
      runId: "run_test",
      signal: new AbortController().signal,
      dependencies: {
        repository,
        executor: new StaticResultExecutor({
          condition_a: {
            status: "completed",
            outputsByPort: {
              false: "branch payload",
              __conditionResult: false,
            },
          },
        }),
        workerId: "worker_test",
      },
    });

    expect(state).toMatchObject({ state: "processed", processed: true });
    const nodes = await repository.listRunNodes("run_test");
    expect(nodes.find((node) => node.nodeId === "condition_a")?.status).toBe("completed");
    expect(nodes.find((node) => node.nodeId === "true_a")?.status).toBe("skipped");
    expect(nodes.find((node) => node.nodeId === "false_a")?.status).toBe("ready");
    expect(
      repository.events.some(
        (event) =>
          event.type === "node.skipped" &&
          event.payload.nodeId === "true_a" &&
          event.payload.reason === "condition_branch_not_taken",
      ),
    ).toBe(true);
  });

  it("executes mutually ready nodes in parallel (batch)", async () => {
    const compiled = makeTwoIndependentInputsCompiled();
    const repository = new FakeExecutionRepository(
      { in1: "a", in2: "b" },
      [makeRunNode(compiled.nodes[0]!, "ready"), makeRunNode(compiled.nodes[1]!, "ready")],
      compiled,
    );
    const executor = new ConcurrencyTrackingExecutor();
    const started = Date.now();
    const state = await processNextRunnableBatch({
      runId: "run_test",
      signal: new AbortController().signal,
      maxConcurrent: 8,
      dependencies: {
        repository,
        executor,
        workerId: "worker_test",
      },
    });
    const elapsed = Date.now() - started;
    expect(state).toMatchObject({
      state: "finalized",
      processed: true,
      processedNodeCount: 2,
    });
    expect(executor.maxActive).toBe(2);
    expect(elapsed).toBeLessThan(85);
  });
});
