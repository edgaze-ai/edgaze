import { computeWorkflowOutcome } from "./outcome";
import type { WorkflowOutcome, WorkflowRunNode, WorkflowRunStatus } from "./types";

export function resolveWorkflowOutcome(params: {
  runStatus: WorkflowRunStatus;
  nodes: Array<Pick<WorkflowRunNode, "status" | "isTerminalNode">>;
}): WorkflowOutcome {
  return computeWorkflowOutcome(params);
}
