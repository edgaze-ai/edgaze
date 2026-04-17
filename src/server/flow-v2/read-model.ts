import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";

import type {
  PayloadReference,
  RunEvent,
  WorkflowRunNode,
  WorkflowRunNodeAttempt,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from "./types";

export interface WorkflowRunBootstrap {
  run: {
    id: string;
    workflowId: string | null;
    workflowVersionId: string | null;
    status: WorkflowRunStatus;
    outcome: string | null;
    compiledWorkflowSnapshot: unknown;
    compiledWorkflowHash: string | null;
    runInput: Record<string, unknown> | null;
    finalOutput: Record<string, unknown> | null;
    cancelRequestedAt: string | null;
    finalizedAt: string | null;
    completedAt: string | null;
    terminalReason: string | null;
    lastEventSequence: number;
    metadata: Record<string, unknown> | null;
    errorDetails: Record<string, unknown> | null;
  };
  nodes: WorkflowRunNode[];
  attempts: WorkflowRunNodeAttempt[];
  dependencyStateByNodeId: Record<
    string,
    Array<{
      dependencyNodeId: string;
      status: "satisfied" | "failed" | "skipped" | "cancelled" | "pending";
    }>
  >;
  events: RunEvent[];
}

function fetchWorkflowRunAccessRow(runId: string) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from("workflow_runs")
    .select("id, user_id, status, metadata")
    .eq("id", runId)
    .maybeSingle();
}

export async function requireWorkflowRunAccess(
  req: Request,
  runId: string,
): Promise<{ runId: string; workflowRunRowStatus: string }> {
  const url = new URL(req.url);
  const runAccessToken =
    url.searchParams.get("runAccessToken") ?? req.headers.get("x-run-access-token");
  const hasRunAccessToken = typeof runAccessToken === "string" && runAccessToken.length > 0;

  type AccessRunRow = {
    id: string;
    user_id: string;
    status: string | null;
    metadata: unknown;
  };

  let cachedRun: AccessRunRow | null = null;

  if (hasRunAccessToken) {
    const { data: run, error: runError } = await fetchWorkflowRunAccessRow(runId);
    if (runError) throw runError;
    if (!run) {
      throw new Error("Run not found");
    }
    cachedRun = run as AccessRunRow;
    const rowStatus = String(run.status ?? "");
    const metadata =
      run.metadata && typeof run.metadata === "object"
        ? (run.metadata as Record<string, unknown>)
        : null;
    if (metadata && metadata.run_access_token === runAccessToken) {
      // Enforce expiry for tokens that carry an expiry timestamp.
      // Tokens issued before this check was added have no expiry field and are
      // allowed through unchanged (backwards compatibility).
      const expiresAt = metadata.run_access_token_expires_at;
      if (expiresAt && new Date(String(expiresAt)).getTime() < Date.now()) {
        throw new Error("Run access link has expired");
      }
      return { runId, workflowRunRowStatus: rowStatus };
    }
  }

  const [{ data: run, error: runError }, { user, error: authError }] = await Promise.all([
    cachedRun
      ? Promise.resolve({ data: cachedRun, error: null })
      : fetchWorkflowRunAccessRow(runId),
    getUserFromRequest(req),
  ]);

  if (runError) throw runError;
  if (!run) {
    throw new Error("Run not found");
  }

  const rowStatus = String(run.status ?? "");

  if (!user) {
    throw new Error(authError ?? "Authentication required");
  }

  if (run.user_id === user.id) {
    return { runId, workflowRunRowStatus: rowStatus };
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    throw new Error("Forbidden");
  }

  return { runId, workflowRunRowStatus: rowStatus };
}

function mapRunNodeRow(row: Record<string, unknown>): WorkflowRunNode {
  return {
    id: String(row.id),
    runId: String(row.workflow_run_id),
    nodeId: String(row.node_id),
    specId: String(row.spec_id),
    topoIndex: Number(row.topo_index ?? 0),
    status: row.status as WorkflowRunNodeStatus,
    failurePolicy: (row.failure_policy as WorkflowRunNode["failurePolicy"]) ?? "fail_fast",
    latestAttemptNumber: Number(row.latest_attempt_number ?? 0),
    inputPayload: (row.input_payload_ref as PayloadReference | null) ?? null,
    outputPayload: (row.output_payload_ref as PayloadReference | null) ?? null,
    errorPayload: (row.error_payload_ref as PayloadReference | null) ?? null,
    queuedAt: (row.queued_at as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    terminalAttemptId: (row.terminal_attempt_id as string | null) ?? null,
    isTerminalNode: Boolean(row.is_terminal_node),
  };
}

function mapRunEventRow(row: Record<string, unknown>): RunEvent {
  const base = {
    sequence: Number(row.sequence),
    runId: String(row.workflow_run_id),
    createdAt: String(row.created_at),
    type: row.event_type as RunEvent["type"],
    payload: (row.payload as RunEvent["payload"]) ?? {},
  };

  return base as RunEvent;
}

function toDependencyStatus(
  status: WorkflowRunNodeStatus,
): "satisfied" | "failed" | "skipped" | "cancelled" | "pending" {
  if (status === "completed" || (status as string) === "success") return "satisfied";
  if (status === "failed" || status === "timed_out") return "failed";
  if (status === "blocked" || status === "skipped") return "skipped";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

/**
 * Cheap poll helper: only the workflow_runs row fields needed to know whether the run is terminal
 * and whether the NDJSON poller has caught up on events. Avoids loading all nodes/events every tick
 * (large image/base64 payloads in node output refs made that path very slow).
 */
export async function peekWorkflowRunStatus(params: { runId: string }): Promise<{
  id: string;
  status: WorkflowRunStatus;
  lastEventSequence: number;
  outcome: string | null;
  cancelRequestedAt: string | null;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("id, status, last_event_sequence, outcome, cancel_requested_at")
    .eq("id", params.runId)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    status: data.status as WorkflowRunStatus,
    lastEventSequence: Number(data.last_event_sequence ?? 0),
    outcome: (data.outcome as string | null) ?? null,
    cancelRequestedAt: (data.cancel_requested_at as string | null) ?? null,
  };
}

export async function listWorkflowRunEvents(params: {
  runId: string;
  afterSequence?: number;
  limit?: number;
}): Promise<RunEvent[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("workflow_run_events")
    .select("workflow_run_id, sequence, event_type, payload, created_at")
    .eq("workflow_run_id", params.runId)
    .order("sequence", { ascending: true });

  if ((params.afterSequence ?? 0) > 0) {
    query = query.gt("sequence", params.afterSequence ?? 0);
  }
  const limit = params.limit;
  if (limit === 0) {
    return [];
  }
  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => mapRunEventRow(row as Record<string, unknown>));
}

export async function loadWorkflowRunBootstrap(params: {
  runId: string;
  afterSequence?: number;
  eventLimit?: number;
}): Promise<WorkflowRunBootstrap> {
  const supabase = createSupabaseAdminClient();

  const { data: runRow, error: runError } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, workflow_version_id, status, outcome, compiled_workflow_snapshot, compiled_workflow_hash, run_input, final_output, cancel_requested_at, finalized_at, completed_at, terminal_reason, last_event_sequence, metadata, error_details",
    )
    .eq("id", params.runId)
    .single();
  if (runError) throw runError;

  const [nodeResult, attemptResult, events] = await Promise.all([
    supabase
      .from("workflow_run_nodes")
      .select(
        "id, workflow_run_id, node_id, spec_id, topo_index, status, failure_policy, latest_attempt_number, input_payload_ref, output_payload_ref, error_payload_ref, queued_at, started_at, ended_at, terminal_attempt_id, is_terminal_node",
      )
      .eq("workflow_run_id", params.runId)
      .order("topo_index", { ascending: true }),
    supabase
      .from("workflow_run_node_attempts")
      .select(
        "id, workflow_run_id, workflow_run_node_id, node_id, attempt_number, status, materialized_input_ref, output_payload_ref, error_payload_ref, started_at, ended_at, duration_ms, worker_id, lease_owner, lease_expires_at, last_heartbeat_at",
      )
      .eq("workflow_run_id", params.runId)
      .order("created_at", { ascending: true }),
    listWorkflowRunEvents({
      runId: params.runId,
      afterSequence: params.afterSequence,
      limit: params.eventLimit,
    }),
  ]);
  const { data: nodeRows, error: nodeError } = nodeResult;
  if (nodeError) throw nodeError;
  const { data: attemptRows, error: attemptError } = attemptResult;
  if (attemptError) throw attemptError;
  const compiled = runRow.compiled_workflow_snapshot as {
    nodes?: Array<{ id: string; dependencyNodeIds?: string[] }>;
  } | null;
  const nodes = (nodeRows ?? []).map((row) => mapRunNodeRow(row as Record<string, unknown>));
  const nodeStatusById = new Map(nodes.map((node) => [node.nodeId, node.status]));
  const dependencyStateByNodeId = Object.fromEntries(
    (compiled?.nodes ?? []).map((node) => [
      node.id,
      (node.dependencyNodeIds ?? []).map((dependencyNodeId) => ({
        dependencyNodeId,
        status: toDependencyStatus(nodeStatusById.get(dependencyNodeId) ?? "pending"),
      })),
    ]),
  );

  return {
    run: {
      id: String(runRow.id),
      workflowId: (runRow.workflow_id as string | null) ?? null,
      workflowVersionId: (runRow.workflow_version_id as string | null) ?? null,
      status: runRow.status as WorkflowRunStatus,
      outcome: (runRow.outcome as string | null) ?? null,
      compiledWorkflowSnapshot: runRow.compiled_workflow_snapshot,
      compiledWorkflowHash: (runRow.compiled_workflow_hash as string | null) ?? null,
      runInput: (runRow.run_input as Record<string, unknown> | null) ?? null,
      finalOutput: (runRow.final_output as Record<string, unknown> | null) ?? null,
      cancelRequestedAt: (runRow.cancel_requested_at as string | null) ?? null,
      finalizedAt: (runRow.finalized_at as string | null) ?? null,
      completedAt: (runRow.completed_at as string | null) ?? null,
      terminalReason: (runRow.terminal_reason as string | null) ?? null,
      lastEventSequence: Number(runRow.last_event_sequence ?? 0),
      metadata: (runRow.metadata as Record<string, unknown> | null) ?? null,
      errorDetails: (runRow.error_details as Record<string, unknown> | null) ?? null,
    },
    nodes,
    attempts: (attemptRows ?? []).map((row) => ({
      id: String(row.id),
      runId: String(row.workflow_run_id),
      runNodeId: String(row.workflow_run_node_id),
      nodeId: String(row.node_id),
      attemptNumber: Number(row.attempt_number ?? 0),
      status: row.status as WorkflowRunNodeAttempt["status"],
      materializedInput: (row.materialized_input_ref as PayloadReference | null) ?? null,
      outputPayload: (row.output_payload_ref as PayloadReference | null) ?? null,
      errorPayload: (row.error_payload_ref as PayloadReference | null) ?? null,
      startedAt: String(row.started_at),
      endedAt: (row.ended_at as string | null) ?? null,
      durationMs: (row.duration_ms as number | null) ?? null,
      workerId: (row.worker_id as string | null) ?? null,
      leaseOwner: (row.lease_owner as string | null) ?? null,
      leaseExpiresAt: (row.lease_expires_at as string | null) ?? null,
      lastHeartbeatAt: (row.last_heartbeat_at as string | null) ?? null,
    })),
    dependencyStateByNodeId,
    events,
  };
}
