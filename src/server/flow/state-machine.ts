import type { ExecutionSnapshot, NodeStatus, WorkflowStatus } from "./types";

type TransitionHook<T> = (current: T, next: T, context?: Record<string, unknown>) => void | Promise<void>;

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["paused", "completed", "completed_with_skips", "failed", "cancelled", "timeout"],
  paused: ["running", "cancelled"],
  completed: [],
  completed_with_skips: [],
  failed: [],
  cancelled: [],
  timeout: [],
};

const NODE_TRANSITIONS: Record<NodeStatus, NodeStatus[]> = {
  idle: ["ready", "running", "skipped", "blocked", "failed"],
  ready: ["running", "skipped", "blocked", "failed"], // Allow ready -> failed for setup/pre-execution errors
  running: ["success", "failed", "timeout", "retrying"],
  retrying: ["running", "failed", "timeout"],
  success: [],
  failed: [],
  skipped: [],
  blocked: [],
  timeout: [],
};

function ensureTransition<T extends string>(
  allowed: Record<T, T[]>,
  current: T,
  next: T,
  label: string
) {
  const options = allowed[current] ?? [];
  if (!options.includes(next)) {
    throw new Error(`Invalid ${label} transition: ${current} -> ${next}`);
  }
}

export function transitionWorkflow(
  current: WorkflowStatus,
  next: WorkflowStatus,
  opts?: { hook?: TransitionHook<WorkflowStatus>; context?: Record<string, unknown> }
): WorkflowStatus {
  ensureTransition(WORKFLOW_TRANSITIONS, current, next, "workflow");
  if (opts?.hook) {
    opts.hook(current, next, opts.context);
  }
  return next;
}

export function transitionNode(
  current: NodeStatus,
  next: NodeStatus,
  opts?: { hook?: TransitionHook<NodeStatus>; context?: Record<string, unknown> }
): NodeStatus {
  ensureTransition(NODE_TRANSITIONS, current, next, "node");
  if (opts?.hook) {
    opts.hook(current, next, opts.context);
  }
  return next;
}

export function initializeSnapshot(params: {
  workflowId?: string;
  nodeIds: string[];
  metadata?: Record<string, unknown>;
}): ExecutionSnapshot {
  const now = Date.now();
  const nodeStatus: Record<string, NodeStatus> = {};
  params.nodeIds.forEach((id) => {
    nodeStatus[id] = "idle";
  });
  return {
    workflowId: params.workflowId,
    workflowStatus: "pending",
    nodeStatus,
    outputsByNode: {},
    startedAt: now,
    updatedAt: now,
    metadata: params.metadata ?? {},
  };
}

export function withUpdatedSnapshot(
  snapshot: ExecutionSnapshot,
  updates: Partial<ExecutionSnapshot>
): ExecutionSnapshot {
  return {
    ...snapshot,
    ...updates,
    nodeStatus: { ...snapshot.nodeStatus, ...(updates.nodeStatus ?? {}) },
    outputsByNode: { ...snapshot.outputsByNode, ...(updates.outputsByNode ?? {}) },
    updatedAt: Date.now(),
  };
}

