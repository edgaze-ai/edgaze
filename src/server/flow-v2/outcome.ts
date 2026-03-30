import type { WorkflowOutcome, WorkflowRunNode, WorkflowRunStatus } from "./types";

const TERMINAL_NODE_STATUSES: ReadonlySet<WorkflowRunNode["status"]> = new Set([
  "completed",
  "failed",
  "timed_out",
  "cancelled",
  "blocked",
  "skipped",
]);

export function isTerminalNodeStatus(status: WorkflowRunNode["status"]): boolean {
  return TERMINAL_NODE_STATUSES.has(status);
}

export function computeWorkflowOutcome(params: {
  runStatus: WorkflowRunStatus;
  nodes: Array<Pick<WorkflowRunNode, "status" | "isTerminalNode">>;
}): WorkflowOutcome {
  if (params.runStatus === "cancelled" || params.runStatus === "cancelling") {
    return "cancelled";
  }

  const terminalNodes = params.nodes.filter((node) => node.isTerminalNode);
  const completedTerminalNodes = terminalNodes.filter((node) => node.status === "completed");
  const failedTerminalNodes = terminalNodes.filter(
    (node) => node.status === "failed" || node.status === "timed_out" || node.status === "cancelled",
  );
  const skippedTerminalNodes = terminalNodes.filter(
    (node) => node.status === "blocked" || node.status === "skipped",
  );
  const nonTerminalFailures = params.nodes.filter(
    (node) =>
      !node.isTerminalNode && (node.status === "failed" || node.status === "timed_out"),
  );

  if (failedTerminalNodes.length > 0 && completedTerminalNodes.length === 0) {
    return "failed";
  }

  if (completedTerminalNodes.length === 0 && (skippedTerminalNodes.length > 0 || nonTerminalFailures.length > 0)) {
    return "failed";
  }

  if (failedTerminalNodes.length > 0 || nonTerminalFailures.length > 0) {
    return "completed_with_errors";
  }

  return "completed";
}
