import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getTraceSession } from "src/server/trace";

import type {
  ClaimedNodeWorkItem,
  CompiledWorkflowDefinition,
  PayloadReference,
  RunEvent,
  SerializableValue,
  WorkflowOutcome,
  WorkflowRunNode,
  WorkflowRunNodeAttemptStatus,
  WorkflowRunStatus,
  WorkflowRunNodeStatus,
} from "./types";

export interface InitializeRunNodeRecord {
  nodeId: string;
  specId: string;
  topoIndex: number;
  status: WorkflowRunNodeStatus;
  failurePolicy: string;
  isTerminalNode: boolean;
  compiledInputBindings: CompiledWorkflowDefinition["nodes"][number]["inputBindings"];
}

export interface WorkflowExecutionRepository {
  freezeCompiledSnapshot(params: {
    runId: string;
    compiled: CompiledWorkflowDefinition;
    runInput: Record<string, SerializableValue>;
  }): Promise<void>;
  initializeRunNodes(params: { runId: string; nodes: InitializeRunNodeRecord[] }): Promise<void>;
  appendRunEvents(params: { runId: string; events: RunEvent[] }): Promise<void>;
  appendRunEvent(params: {
    runId: string;
    type: RunEvent["type"];
    payload: RunEvent["payload"];
    nodeId?: string;
    attemptNumber?: number;
    createdAt?: string;
  }): Promise<number>;
  appendRunEventsBatch(params: {
    runId: string;
    events: Array<{
      type: RunEvent["type"];
      payload: RunEvent["payload"];
      nodeId?: string;
      attemptNumber?: number;
      createdAt?: string;
    }>;
  }): Promise<number[]>;
  markCancellationRequested(params: { runId: string }): Promise<void>;
  claimNextRunnableNode(params: {
    runId: string;
    workerId: string;
    leaseDurationSec?: number;
  }): Promise<ClaimedNodeWorkItem | null>;
  renewAttemptLease(params: {
    attemptId: string;
    leaseOwner: string;
    leaseDurationSec?: number;
  }): Promise<boolean>;
  getRunState(params: { runId: string }): Promise<{
    status: WorkflowRunStatus;
    cancelRequestedAt: string | null;
    compiled: CompiledWorkflowDefinition;
    lastEventSequence: number;
  }>;
  listRunNodes(runId: string): Promise<WorkflowRunNode[]>;
  updateNodeStatuses(params: {
    runId: string;
    nodeIds: string[];
    status: WorkflowRunNodeStatus;
    onlyCurrentStatuses?: WorkflowRunNodeStatus[];
    queuedAt?: string | null;
    endedAt?: string | null;
  }): Promise<string[]>;
  loadRunInput(runId: string): Promise<Record<string, SerializableValue>>;
  loadUpstreamOutputs(params: {
    runId: string;
    sourceNodeIds: string[];
  }): Promise<Record<string, PayloadReference | SerializableValue | undefined>>;
  persistAttemptMaterializedInput(params: {
    attemptId: string;
    runNodeId: string;
    attemptNumber: number;
    leaseOwner: string;
    inputPayload: PayloadReference;
  }): Promise<void>;
  persistAttemptResult(params: {
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
  }): Promise<void>;
  finalizeRun(params: {
    runId: string;
    status: WorkflowRunStatus;
    outcome: WorkflowOutcome;
    finalOutput?: PayloadReference | null;
    terminalReason?: string | null;
  }): Promise<void>;
}

function toAttemptStatus(status: string): WorkflowRunNodeAttemptStatus {
  if (status === "completed") return "completed";
  if (status === "timed_out") return "timed_out";
  if (status === "cancelled") return "cancelled";
  return "failed";
}

function toRunNodeStatus(status: string): WorkflowRunNodeStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "timed_out":
      return "timed_out";
    case "cancelled":
      return "cancelled";
    case "failed":
    default:
      return "failed";
  }
}

export class SupabaseWorkflowExecutionRepository implements WorkflowExecutionRepository {
  private readonly compiledByRunId = new Map<string, CompiledWorkflowDefinition>();
  private readonly compiledNodeByRunId = new Map<
    string,
    Map<string, CompiledWorkflowDefinition["nodes"][number]>
  >();
  private readonly runInputByRunId = new Map<string, Record<string, SerializableValue>>();

  private rememberCompiled(runId: string, compiled: CompiledWorkflowDefinition): void {
    this.compiledByRunId.set(runId, compiled);
    this.compiledNodeByRunId.set(runId, new Map(compiled.nodes.map((node) => [node.id, node])));
  }

  private rememberRunInput(runId: string, runInput: Record<string, SerializableValue>): void {
    this.runInputByRunId.set(runId, runInput);
  }

  private clearRunCache(runId: string): void {
    this.compiledByRunId.delete(runId);
    this.compiledNodeByRunId.delete(runId);
    this.runInputByRunId.delete(runId);
  }

  primeRunCache(params: {
    runId: string;
    compiled?: CompiledWorkflowDefinition | null;
    runInput?: Record<string, SerializableValue> | null;
  }): void {
    if (params.compiled) {
      this.rememberCompiled(params.runId, params.compiled);
    }
    if (params.runInput) {
      this.rememberRunInput(params.runId, params.runInput);
    }
  }

  async freezeCompiledSnapshot(params: {
    runId: string;
    compiled: CompiledWorkflowDefinition;
    runInput: Record<string, SerializableValue>;
  }): Promise<void> {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("workflow_runs")
      .update({
        compiled_workflow_snapshot: params.compiled,
        compiled_workflow_hash: params.compiled.snapshotHash,
        run_input: params.runInput,
        last_event_sequence: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.runId);

    if (error) throw error;
    this.rememberCompiled(params.runId, params.compiled);
    this.rememberRunInput(params.runId, params.runInput);
  }

  async initializeRunNodes(params: {
    runId: string;
    nodes: InitializeRunNodeRecord[];
  }): Promise<void> {
    if (params.nodes.length === 0) return;

    const supabase = createSupabaseAdminClient() as any;
    const { data: existingRows, error: existingError } = await supabase
      .from("workflow_run_nodes")
      .select("id, node_id")
      .eq("workflow_run_id", params.runId);

    if (existingError) throw existingError;

    const existingByNodeId = new Map(
      (existingRows ?? []).map((row: any) => [String(row.node_id), String(row.id)]),
    );

    const now = new Date().toISOString();
    const inserts = params.nodes
      .filter((node) => !existingByNodeId.has(node.nodeId))
      .map((node) => ({
        workflow_run_id: params.runId,
        node_id: node.nodeId,
        spec_id: node.specId,
        topo_index: node.topoIndex,
        status: node.status,
        failure_policy: node.failurePolicy,
        compiled_input_bindings: node.compiledInputBindings,
        latest_attempt_number: 0,
        is_terminal_node: node.isTerminalNode,
        started_at: now,
      }));

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("workflow_run_nodes").insert(inserts);
      if (insertError) throw insertError;
    }

    for (const node of params.nodes) {
      const existingId = existingByNodeId.get(node.nodeId);
      if (!existingId) continue;

      const { error: updateError } = await supabase
        .from("workflow_run_nodes")
        .update({
          spec_id: node.specId,
          topo_index: node.topoIndex,
          status: node.status,
          failure_policy: node.failurePolicy,
          compiled_input_bindings: node.compiledInputBindings,
          is_terminal_node: node.isTerminalNode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);

      if (updateError) throw updateError;
    }
  }

  async appendRunEvents(params: { runId: string; events: RunEvent[] }): Promise<void> {
    if (params.events.length === 0) return;

    const supabase = createSupabaseAdminClient() as any;
    const rows = params.events.map((event) => ({
      workflow_run_id: params.runId,
      sequence: event.sequence,
      event_type: event.type,
      node_id: "nodeId" in event.payload ? event.payload.nodeId : null,
      attempt_number:
        "attemptNumber" in event.payload ? (event.payload.attemptNumber ?? null) : null,
      payload: event.payload,
      created_at: event.createdAt,
    }));

    const { error: insertError } = await supabase.from("workflow_run_events").insert(rows);
    if (insertError) throw insertError;

    const lastSequence = params.events[params.events.length - 1]?.sequence ?? 0;
    const { error: updateError } = await supabase
      .from("workflow_runs")
      .update({
        last_event_sequence: lastSequence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.runId);

    if (updateError) throw updateError;
  }

  async appendRunEvent(params: {
    runId: string;
    type: RunEvent["type"];
    payload: RunEvent["payload"];
    nodeId?: string;
    attemptNumber?: number;
    createdAt?: string;
  }): Promise<number> {
    const trace = getTraceSession(`workflow:${params.runId}`);
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.rpc("append_workflow_run_event", {
      p_run_id: params.runId,
      p_event_type: params.type,
      p_payload: params.payload,
      p_node_id: params.nodeId ?? null,
      p_attempt_number: params.attemptNumber ?? null,
      p_created_at: params.createdAt ?? new Date().toISOString(),
    });

    if (error) throw error;
    const tracePayload = {
      phase: "worker" as const,
      source: "workflow" as const,
      eventName: "repository.append_run_event",
      severity: "debug" as const,
      payload: {
        runId: params.runId,
        type: params.type,
        nodeId: params.nodeId ?? null,
        attemptNumber: params.attemptNumber ?? null,
        sequence: Number(data),
      },
    };
    if (params.type === "node.stream.delta") {
      void trace?.record(tracePayload);
    } else {
      await trace?.record(tracePayload);
    }
    return Number(data);
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
    if (params.events.length === 0) return [];

    const trace = getTraceSession(`workflow:${params.runId}`);
    const supabase = createSupabaseAdminClient() as any;
    const rpcPayload = params.events.map((event) => ({
      event_type: event.type,
      payload: event.payload,
      node_id: event.nodeId ?? null,
      attempt_number: event.attemptNumber ?? null,
      created_at: event.createdAt ?? new Date().toISOString(),
    }));
    const { data, error } = await supabase.rpc("append_workflow_run_events", {
      p_run_id: params.runId,
      p_events: rpcPayload,
    });

    if (!error) {
      await trace?.record({
        phase: "worker",
        source: "workflow",
        eventName: "repository.append_run_events_batch",
        severity: "debug",
        payload: {
          runId: params.runId,
          count: params.events.length,
          eventTypes: params.events.map((event) => event.type),
        },
      });
      return Array.isArray(data)
        ? data.map((entry) =>
            typeof entry === "number"
              ? Number(entry)
              : Number((entry as { sequence?: number | string }).sequence ?? 0),
          )
        : [];
    }

    const errorCode =
      typeof error === "object" && error && "code" in error ? String(error.code ?? "") : "";
    const functionMissing =
      errorCode === "42883" || /append_workflow_run_events/i.test(error.message);
    if (!functionMissing) {
      throw error;
    }

    const sequences: number[] = [];
    for (const event of params.events) {
      sequences.push(
        await this.appendRunEvent({
          runId: params.runId,
          type: event.type,
          payload: event.payload,
          nodeId: event.nodeId,
          attemptNumber: event.attemptNumber,
          createdAt: event.createdAt,
        }),
      );
    }
    return sequences;
  }

  async markCancellationRequested(params: { runId: string }): Promise<void> {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("workflow_runs")
      .update({
        cancel_requested_at: now,
        status: "cancelling",
        updated_at: now,
      })
      .eq("id", params.runId)
      .in("status", ["pending", "running"]);

    if (error) throw error;
  }

  async claimNextRunnableNode(params: {
    runId: string;
    workerId: string;
    leaseDurationSec?: number;
  }): Promise<ClaimedNodeWorkItem | null> {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase.rpc("claim_workflow_run_node_attempt", {
      p_run_id: params.runId,
      p_worker_id: params.workerId,
      p_lease_seconds: params.leaseDurationSec ?? 30,
    });

    if (error) {
      console.error("[flow-v2] claim_workflow_run_node_attempt RPC failed", {
        runId: params.runId,
        workerId: params.workerId,
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
      });
      throw error;
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) return null;

    let compiled = this.compiledByRunId.get(params.runId);
    let compiledNode = this.compiledNodeByRunId.get(params.runId)?.get(String(row.node_id));
    if (!compiled || !compiledNode) {
      const { data: runRow, error: runError } = await supabase
        .from("workflow_runs")
        .select("compiled_workflow_snapshot" as any)
        .eq("id", params.runId)
        .single();

      if (runError) throw runError;

      compiled = runRow.compiled_workflow_snapshot as CompiledWorkflowDefinition | undefined;
      if (compiled) {
        this.rememberCompiled(params.runId, compiled);
        compiledNode = this.compiledNodeByRunId.get(params.runId)?.get(String(row.node_id));
      }
    }
    if (!compiled || !compiledNode) {
      throw new Error(`Compiled node "${String(row.node_id)}" not found for claimed work item.`);
    }

    return {
      runId: String(row.workflow_run_id),
      runNodeId: String(row.workflow_run_node_id),
      attemptId: String(row.attempt_id),
      attemptNumber: Number(row.attempt_number),
      leaseOwner: String(row.lease_owner ?? params.workerId),
      leaseExpiresAt: (row.lease_expires_at as string | null) ?? null,
      compiledNode,
    };
  }

  async renewAttemptLease(params: {
    attemptId: string;
    leaseOwner: string;
    leaseDurationSec?: number;
  }): Promise<boolean> {
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (params.leaseDurationSec ?? 30) * 1000,
    ).toISOString();
    const { data, error } = await supabase
      .from("workflow_run_node_attempts")
      .update({
        lease_expires_at: expiresAt,
        last_heartbeat_at: now.toISOString(),
      })
      .eq("id", params.attemptId)
      .eq("status", "running")
      .eq("lease_owner", params.leaseOwner)
      .select("id");

    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  }

  async getRunState(params: { runId: string }): Promise<{
    status: WorkflowRunStatus;
    cancelRequestedAt: string | null;
    compiled: CompiledWorkflowDefinition;
    lastEventSequence: number;
  }> {
    const supabase = createSupabaseAdminClient() as any;
    const cachedCompiled = this.compiledByRunId.get(params.runId) ?? null;
    const selectColumns = cachedCompiled
      ? "status, cancel_requested_at, last_event_sequence"
      : "status, cancel_requested_at, compiled_workflow_snapshot, last_event_sequence";
    const { data, error } = await supabase
      .from("workflow_runs")
      .select(selectColumns as any)
      .eq("id", params.runId)
      .single();

    if (error) throw error;
    const compiled =
      cachedCompiled ?? (data.compiled_workflow_snapshot as CompiledWorkflowDefinition | null);
    if (!compiled) {
      throw new Error(`Run "${params.runId}" is missing compiled_workflow_snapshot.`);
    }
    if (!cachedCompiled) {
      this.rememberCompiled(params.runId, compiled);
    }

    return {
      status: data.status as WorkflowRunStatus,
      cancelRequestedAt: (data.cancel_requested_at as string | null) ?? null,
      compiled,
      lastEventSequence: Number(data.last_event_sequence ?? 0),
    };
  }

  async listRunNodes(runId: string): Promise<WorkflowRunNode[]> {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("workflow_run_nodes")
      .select(
        "id, workflow_run_id, node_id, spec_id, topo_index, status, failure_policy, latest_attempt_number, input_payload_ref, output_payload_ref, error_payload_ref, queued_at, started_at, ended_at, terminal_attempt_id, is_terminal_node",
      )
      .eq("workflow_run_id", runId)
      .order("topo_index", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
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
    }));
  }

  async updateNodeStatuses(params: {
    runId: string;
    nodeIds: string[];
    status: WorkflowRunNodeStatus;
    onlyCurrentStatuses?: WorkflowRunNodeStatus[];
    queuedAt?: string | null;
    endedAt?: string | null;
  }): Promise<string[]> {
    if (params.nodeIds.length === 0) return [];

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("workflow_run_nodes")
      .update({
        status: params.status,
        queued_at: params.queuedAt ?? undefined,
        ended_at: params.endedAt ?? undefined,
      })
      .eq("workflow_run_id", params.runId)
      .in("node_id", params.nodeIds);

    if (params.onlyCurrentStatuses && params.onlyCurrentStatuses.length > 0) {
      query = query.in("status", params.onlyCurrentStatuses);
    }

    const { data, error } = await query.select("node_id");
    if (error) throw error;

    return (data ?? []).map((row: any) => String(row.node_id));
  }

  async loadRunInput(runId: string): Promise<Record<string, SerializableValue>> {
    const cached = this.runInputByRunId.get(runId);
    if (cached) return cached;

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("workflow_runs")
      .select("run_input")
      .eq("id", runId)
      .single();
    if (error) throw error;
    const runInput = ((data.run_input as Record<string, SerializableValue> | null) ?? {}) as Record<
      string,
      SerializableValue
    >;
    this.rememberRunInput(runId, runInput);
    return runInput;
  }

  async loadUpstreamOutputs(params: {
    runId: string;
    sourceNodeIds: string[];
  }): Promise<Record<string, PayloadReference | SerializableValue | undefined>> {
    if (params.sourceNodeIds.length === 0) return {};

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("workflow_run_nodes")
      .select("node_id, output_payload_ref")
      .eq("workflow_run_id", params.runId)
      .in("node_id", params.sourceNodeIds);

    if (error) throw error;

    const outputs: Record<string, PayloadReference | SerializableValue | undefined> = {};
    for (const row of data ?? []) {
      outputs[String(row.node_id)] =
        (row.output_payload_ref as PayloadReference | null) ?? undefined;
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
    const supabase = createSupabaseAdminClient() as any;

    const { error: attemptError } = await supabase
      .from("workflow_run_node_attempts")
      .update({
        materialized_input_ref: params.inputPayload,
      })
      .eq("id", params.attemptId)
      .eq("status", "running")
      .eq("lease_owner", params.leaseOwner);
    if (attemptError) throw attemptError;

    const { error: nodeError } = await supabase
      .from("workflow_run_nodes")
      .update({
        input_payload_ref: params.inputPayload,
      })
      .eq("id", params.runNodeId)
      .eq("status", "running")
      .eq("latest_attempt_number", params.attemptNumber);
    if (nodeError) throw nodeError;
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
    const supabase = createSupabaseAdminClient() as any;
    const attemptStatus = toAttemptStatus(params.result.status);
    const nodeStatus = toRunNodeStatus(params.result.status);
    const endedAt = params.result.metrics?.endedAt ?? new Date().toISOString();
    const durationMs = params.result.metrics?.durationMs ?? null;

    const { error: attemptError } = await supabase
      .from("workflow_run_node_attempts")
      .update({
        status: attemptStatus,
        materialized_input_ref: params.inputPayload ?? undefined,
        output_payload_ref: params.outputPayload,
        error_payload_ref: params.errorPayload,
        ended_at: endedAt,
        duration_ms: durationMs,
      })
      .eq("id", params.attemptId)
      .eq("status", "running")
      .eq("lease_owner", params.leaseOwner);
    if (attemptError) throw attemptError;

    const { error: nodeError } = await supabase
      .from("workflow_run_nodes")
      .update({
        status: nodeStatus,
        input_payload_ref: params.inputPayload ?? undefined,
        output_payload_ref: params.outputPayload,
        error_payload_ref: params.errorPayload,
        ended_at: endedAt,
        terminal_attempt_id: params.attemptId,
      })
      .eq("id", params.runNodeId)
      .eq("status", "running")
      .eq("latest_attempt_number", params.attemptNumber);
    if (nodeError) throw nodeError;
  }

  async finalizeRun(params: {
    runId: string;
    status: WorkflowRunStatus;
    outcome: WorkflowOutcome;
    finalOutput?: PayloadReference | null;
    terminalReason?: string | null;
  }): Promise<void> {
    const trace = getTraceSession(`workflow:${params.runId}`);
    const supabase = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("workflow_runs")
      .update({
        status: params.status,
        outcome: params.outcome,
        terminal_reason: params.terminalReason ?? null,
        final_output: params.finalOutput ?? null,
        finalized_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", params.runId)
      .in("status", ["pending", "running", "cancelling"]);

    if (error) throw error;
    await trace?.record({
      phase: "worker",
      source: "workflow",
      eventName: "repository.finalize_run",
      payload: {
        runId: params.runId,
        status: params.status,
        outcome: params.outcome,
        terminalReason: params.terminalReason ?? null,
      },
    });
    this.clearRunCache(params.runId);
  }
}
