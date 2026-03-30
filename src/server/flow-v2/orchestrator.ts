import type { CompiledWorkflowDefinition, RunEvent, SerializableValue } from "./types";
import type { InitializeRunNodeRecord, WorkflowExecutionRepository } from "./repository";

export function buildInitialRunNodeRecords(
  compiled: CompiledWorkflowDefinition,
): InitializeRunNodeRecord[] {
  return compiled.nodes.map((node) => ({
    nodeId: node.id,
    specId: node.specId,
    topoIndex: node.topoIndex,
    status: node.isEntryNode ? "ready" : "pending",
    failurePolicy: node.failurePolicy,
    isTerminalNode: node.isTerminalNode,
    compiledInputBindings: node.inputBindings,
  }));
}

export function buildRunInitializationEvents(params: {
  runId: string;
  compiled: CompiledWorkflowDefinition;
  workflowId?: string;
}): RunEvent[] {
  const createdAt = new Date().toISOString();
  const events: RunEvent[] = [
    {
      sequence: 1,
      runId: params.runId,
      createdAt,
      type: "run.created",
      payload: {
        snapshotHash: params.compiled.snapshotHash,
        workflowId: params.workflowId ?? params.compiled.workflowId ?? null,
        nodeCount: params.compiled.nodes.length,
      },
    },
  ];

  let sequence = 2;
  for (const nodeId of params.compiled.entryNodeIds) {
    events.push({
      sequence,
      runId: params.runId,
      createdAt,
      type: "node.ready",
      payload: {
        nodeId,
        status: "ready",
        message: "Entry node is ready for deterministic scheduling.",
      },
    });
    sequence += 1;
  }

  return events;
}

export class WorkflowRunOrchestrator {
  constructor(private readonly repository: WorkflowExecutionRepository) {}

  async initializeRun(params: {
    runId: string;
    compiled: CompiledWorkflowDefinition;
    runInput: Record<string, SerializableValue>;
    workflowId?: string;
  }): Promise<void> {
    await this.repository.freezeCompiledSnapshot({
      runId: params.runId,
      compiled: params.compiled,
      runInput: params.runInput,
    });

    await this.repository.initializeRunNodes({
      runId: params.runId,
      nodes: buildInitialRunNodeRecords(params.compiled),
    });

    await this.repository.appendRunEvents({
      runId: params.runId,
      events: buildRunInitializationEvents({
        runId: params.runId,
        compiled: params.compiled,
        workflowId: params.workflowId,
      }),
    });
  }

  async requestCancellation(runId: string): Promise<void> {
    await this.repository.markCancellationRequested({ runId });
  }
}
