import { initializeSnapshot, transitionNode, transitionWorkflow, withUpdatedSnapshot } from "./state-machine";
import type { ExecutionSnapshot, NodeStatus, WorkflowStatus } from "./types";

type PersistHook = (snapshot: ExecutionSnapshot) => void | Promise<void>;

export class ExecutionStateManager {
  private snapshot: ExecutionSnapshot;
  private readonly persistHook?: PersistHook;

  constructor(params: { workflowId?: string; nodeIds: string[]; metadata?: Record<string, unknown>; persistHook?: PersistHook }) {
    this.snapshot = initializeSnapshot({
      workflowId: params.workflowId,
      nodeIds: params.nodeIds,
      metadata: params.metadata,
    });
    this.persistHook = params.persistHook;
  }

  static fromSnapshot(snapshot: ExecutionSnapshot, persistHook?: PersistHook) {
    const mgr = new ExecutionStateManager({
      workflowId: snapshot.workflowId,
      nodeIds: Object.keys(snapshot.nodeStatus),
      metadata: snapshot.metadata,
      persistHook,
    });
    mgr.snapshot = snapshot;
    return mgr;
  }

  getSnapshot(): ExecutionSnapshot {
    return this.snapshot;
  }

  setWorkflowStatus(next: WorkflowStatus) {
    const updatedStatus = transitionWorkflow(this.snapshot.workflowStatus, next);
    this.snapshot = withUpdatedSnapshot(this.snapshot, { workflowStatus: updatedStatus });
    this.persist();
    return updatedStatus;
  }

  setNodeStatus(nodeId: string, next: NodeStatus) {
    const current = this.snapshot.nodeStatus[nodeId] ?? "idle";
    const updated = transitionNode(current, next);
    this.snapshot = withUpdatedSnapshot(this.snapshot, {
      nodeStatus: { ...this.snapshot.nodeStatus, [nodeId]: updated },
    });
    this.persist();
    return updated;
  }

  setNodeOutput(nodeId: string, value: unknown) {
    this.snapshot = withUpdatedSnapshot(this.snapshot, {
      outputsByNode: { ...this.snapshot.outputsByNode, [nodeId]: value },
    });
    this.persist();
  }

  checkpoint(partial?: Partial<ExecutionSnapshot>) {
    this.snapshot = withUpdatedSnapshot(this.snapshot, partial ?? {});
    this.persist();
    return this.snapshot;
  }

  private persist() {
    if (!this.persistHook) return;
    this.persistHook(this.snapshot);
  }
}

