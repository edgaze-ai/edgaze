import { describe, expect, it } from "vitest";

import type { NodeExecutor } from "./node-executor";
import type { WorkflowExecutionRepository } from "./repository";
import type {
  ClaimedNodeWorkItem,
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
import { runWorkflowToTerminal, WorkflowRunnerStalledError } from "./worker-runner";

class NoopRepository implements WorkflowExecutionRepository {
  protected readonly compiled: CompiledWorkflowDefinition = {
    workflowId: "wf_test",
    versionId: "version_test",
    snapshotHash: "hash_test",
    compiledAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    topoOrder: [],
    entryNodeIds: [],
    terminalNodeIds: [],
    dependencyMap: {},
    downstreamMap: {},
  };

  async freezeCompiledSnapshot(): Promise<void> {}
  async initializeRunNodes(): Promise<void> {}
  async appendRunEvents(_: { runId: string; events: RunEvent[] }): Promise<void> {}
  async appendRunEvent(_: {
    runId: string;
    type: RunEvent["type"];
    payload: RunEvent["payload"];
    nodeId?: string;
    attemptNumber?: number;
    createdAt?: string;
  }): Promise<number> {
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
  async markCancellationRequested(_: { runId: string }): Promise<void> {}
  async claimNextRunnableNode(_: {
    runId: string;
    workerId: string;
    leaseDurationSec?: number;
  }): Promise<ClaimedNodeWorkItem | null> {
    return null;
  }
  async renewAttemptLease(): Promise<boolean> {
    return true;
  }
  async getRunState(_: { runId: string }): Promise<{
    status: WorkflowRunStatus;
    cancelRequestedAt: string | null;
    compiled: CompiledWorkflowDefinition;
    lastEventSequence: number;
  }> {
    return {
      status: "queued",
      cancelRequestedAt: null,
      compiled: this.compiled,
      lastEventSequence: 0,
    };
  }
  async listRunNodes(_: string): Promise<WorkflowRunNode[]> {
    return [];
  }
  async updateNodeStatuses(_: {
    runId: string;
    nodeIds: string[];
    status: WorkflowRunNodeStatus;
    onlyCurrentStatuses?: WorkflowRunNodeStatus[];
    queuedAt?: string | null;
    endedAt?: string | null;
  }): Promise<string[]> {
    return [];
  }
  async loadRunInput(_: string): Promise<Record<string, SerializableValue>> {
    return {};
  }
  async loadUpstreamOutputs(_: {
    runId: string;
    sourceNodeIds: string[];
  }): Promise<Record<string, PayloadReference | SerializableValue | undefined>> {
    return {};
  }
  async persistAttemptMaterializedInput(_: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    inputPayload: PayloadReference;
  }): Promise<void> {}
  async persistAttemptResult(_: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    result: {
      status: WorkflowRunNodeAttemptStatus | "completed" | "failed" | "timed_out" | "cancelled";
      metrics?: { endedAt: string; durationMs: number };
    };
    outputPayload: PayloadReference | null;
    errorPayload: PayloadReference | null;
  }): Promise<void> {}
  async finalizeRun(_: {
    runId: string;
    status: WorkflowRunStatus;
    outcome: WorkflowOutcome;
    finalOutput?: PayloadReference | null;
    terminalReason?: string | null;
  }): Promise<void> {}
}

class NoopExecutor implements NodeExecutor {
  async execute() {
    return {
      status: "completed" as const,
      output: null,
      metrics: {
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1,
      },
    };
  }
}

class SequenceRepository extends NoopRepository {
  constructor(private readonly sequence: Array<"processed" | "idle" | "finalized">) {
    super();
  }

  private index = 0;

  override async getRunState(_: { runId: string }) {
    const state = this.sequence[Math.min(this.index, this.sequence.length - 1)] ?? "finalized";
    return {
      status: state === "finalized" ? ("completed" as const) : ("running" as const),
      cancelRequestedAt: null,
      compiled: this.compiled,
      lastEventSequence: this.index,
    };
  }

  override async claimNextRunnableNode(_: {
    runId: string;
    workerId: string;
    leaseDurationSec?: number;
  }): Promise<ClaimedNodeWorkItem | null> {
    const current = this.sequence[this.index] ?? "finalized";
    if (current !== "processed") return null;
    this.index += 1;
    return {
      runId: "run_test",
      runNodeId: "run_node_test",
      attemptId: `attempt_${this.index}`,
      attemptNumber: this.index,
      leaseOwner: "worker_test",
      leaseExpiresAt: null,
      compiledNode: {
        id: "input_a",
        specId: "input",
        config: {},
        failurePolicy: "fail_fast",
        topoIndex: 0,
        inputPorts: [],
        outputPorts: [],
        inputBindings: [],
        dependencyNodeIds: [],
        downstreamNodeIds: [],
        isEntryNode: true,
        isTerminalNode: true,
      },
    };
  }

  override async listRunNodes(_: string): Promise<WorkflowRunNode[]> {
    const current = this.sequence[this.index] ?? "finalized";
    if (current === "finalized") {
      return [
        {
          id: "run_node_test",
          runId: "run_test",
          nodeId: "input_a",
          specId: "input",
          topoIndex: 0,
          status: "completed" as const,
          failurePolicy: "fail_fast" as const,
          latestAttemptNumber: this.index,
          inputPayload: null,
          outputPayload: null,
          errorPayload: null,
          queuedAt: null,
          startedAt: null,
          endedAt: null,
          terminalAttemptId: null,
          isTerminalNode: true,
        },
      ];
    }

    this.index += 1;
    return [
      {
        id: "run_node_test",
        runId: "run_test",
        nodeId: "input_a",
        specId: "input",
        topoIndex: 0,
        status: "pending" as const,
        failurePolicy: "fail_fast" as const,
        latestAttemptNumber: this.index,
        inputPayload: null,
        outputPayload: null,
        errorPayload: null,
        queuedAt: null,
        startedAt: null,
        endedAt: null,
        terminalAttemptId: null,
        isTerminalNode: true,
      },
    ];
  }
}

describe("runWorkflowToTerminal", () => {
  it("drains processed work until the run is finalized", async () => {
    const result = await runWorkflowToTerminal({
      runId: "run_test",
      signal: new AbortController().signal,
      dependencies: {
        repository: new SequenceRepository(["processed", "finalized"]),
        executor: new NoopExecutor(),
        workerId: "worker_test",
      },
      options: {
        maxIterations: 10,
        maxConsecutiveIdleCycles: 2,
        idleBackoffMs: 0,
      },
    });

    expect(result.terminalState).toBe("finalized");
    expect(result.processedCount).toBe(1);
  });

  it("fails closed when the run stays idle without finalizing", async () => {
    await expect(
      runWorkflowToTerminal({
        runId: "run_test",
        signal: new AbortController().signal,
        dependencies: {
          repository: new NoopRepository(),
          executor: new NoopExecutor(),
          workerId: "worker_test",
        },
        options: {
          maxIterations: 5,
          maxConsecutiveIdleCycles: 1,
          idleBackoffMs: 0,
        },
      }),
    ).rejects.toBeInstanceOf(WorkflowRunnerStalledError);
  });
});
