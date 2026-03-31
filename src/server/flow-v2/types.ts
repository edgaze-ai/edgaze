import type { FailurePolicy as LegacyFailurePolicy } from "@lib/workflow/workflow-policy";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type SerializableValue = JsonValue;

export type PortValueType =
  | "file"
  | "image"
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "json"
  | "array"
  | "binary";

export type PortMultiplicity = "single" | "multi_list" | "multi_object";

export type PortObjectKeySource = "source_node_id" | "source_port_id" | "edge_label";

export type FailurePolicy = LegacyFailurePolicy;

export type WorkflowOutcome = "completed" | "completed_with_errors" | "failed" | "cancelled";

export type WorkflowRunStatus =
  | "created"
  | "queued"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowRunNodeStatus =
  | "pending"
  | "ready"
  | "queued"
  | "running"
  | "retry_scheduled"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "blocked"
  | "skipped";

export type WorkflowRunNodeAttemptStatus =
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export interface WorkflowDefinitionNode {
  id: string;
  specId: string;
  title?: string;
  config: Record<string, SerializableValue>;
}

export interface WorkflowDefinitionEdge {
  id?: string;
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
}

export interface WorkflowDefinition {
  workflowId?: string;
  versionId?: string | null;
  builderVersion?: string | null;
  nodes: WorkflowDefinitionNode[];
  edges: WorkflowDefinitionEdge[];
}

export interface PortSpec {
  id: string;
  name: string;
  kind: "input" | "output";
  label?: string;
  valueType: PortValueType;
  required: boolean;
  multiplicity: PortMultiplicity;
  description?: string;
  objectKeyFrom?: PortObjectKeySource;
}

export interface CompiledEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  bindingOrderKey: string;
}

export interface CompiledInputBinding {
  edgeId: string;
  targetPortId: string;
  targetNodeId: string;
  sourceNodeId: string;
  sourcePortId: string;
  sourceValueType: PortValueType;
  targetValueType: PortValueType;
  multiplicity: PortMultiplicity;
  objectEntryKey?: string;
  bindingOrderKey: string;
}

export interface CompiledNode {
  id: string;
  specId: string;
  title?: string;
  config: Record<string, SerializableValue>;
  failurePolicy: FailurePolicy;
  topoIndex: number;
  inputPorts: PortSpec[];
  outputPorts: PortSpec[];
  inputBindings: CompiledInputBinding[];
  dependencyNodeIds: string[];
  downstreamNodeIds: string[];
  isEntryNode: boolean;
  isTerminalNode: boolean;
}

export interface CompiledWorkflowDefinition {
  workflowId?: string;
  versionId?: string | null;
  snapshotHash: string;
  compiledAt: string;
  nodes: CompiledNode[];
  edges: CompiledEdge[];
  topoOrder: string[];
  entryNodeIds: string[];
  terminalNodeIds: string[];
  dependencyMap: Record<string, string[]>;
  downstreamMap: Record<string, string[]>;
}

export interface PayloadReference {
  id?: string;
  storageKind: "inline" | "database_blob" | "object_storage";
  contentType: "application/json" | "text/plain";
  byteLength?: number | null;
  sha256?: string | null;
  objectPath?: string | null;
  value?: SerializableValue;
}

export interface WorkflowRun {
  id: string;
  workflowId?: string | null;
  workflowVersionId?: string | null;
  status: WorkflowRunStatus;
  outcome: WorkflowOutcome | null;
  compiledWorkflowSnapshot: CompiledWorkflowDefinition;
  runInput: PayloadReference;
  finalOutput: PayloadReference | null;
  cancelRequestedAt: string | null;
  startedAt: string;
  finalizedAt: string | null;
  completedAt: string | null;
  lastEventSequence: number;
  metadata: Record<string, SerializableValue>;
}

export interface WorkflowRunNode {
  id: string;
  runId: string;
  nodeId: string;
  specId: string;
  topoIndex: number;
  status: WorkflowRunNodeStatus;
  failurePolicy: FailurePolicy;
  latestAttemptNumber: number;
  inputPayload: PayloadReference | null;
  outputPayload: PayloadReference | null;
  errorPayload: PayloadReference | null;
  queuedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  terminalAttemptId: string | null;
  isTerminalNode: boolean;
}

export interface WorkflowRunNodeAttempt {
  id: string;
  runId: string;
  runNodeId: string;
  nodeId: string;
  attemptNumber: number;
  status: WorkflowRunNodeAttemptStatus;
  materializedInput: PayloadReference | null;
  outputPayload: PayloadReference | null;
  errorPayload: PayloadReference | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  workerId: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface ClaimedNodeWorkItem {
  runId: string;
  runNodeId: string;
  attemptId: string;
  attemptNumber: number;
  leaseOwner: string;
  leaseExpiresAt: string | null;
  compiledNode: CompiledNode;
}

export interface MaterializedInputSourceValue {
  edgeId: string;
  targetPortId: string;
  sourceNodeId: string | "__run_input__" | "__node_config__";
  sourcePortId: string;
  objectEntryKey?: string;
  value: SerializableValue;
}

export interface MaterializedNodeInputPort {
  targetPortId: string;
  multiplicity: PortMultiplicity;
  valueType: PortValueType;
  value: SerializableValue;
  sources: MaterializedInputSourceValue[];
}

export interface MaterializedNodeInput {
  runId: string;
  nodeId: string;
  specId: string;
  attemptNumber: number;
  config: Record<string, SerializableValue>;
  ports: Record<string, MaterializedNodeInputPort>;
}

export interface NodeExecutionResult {
  status: "completed" | "failed" | "timed_out" | "cancelled";
  outputsByPort?: Record<string, SerializableValue>;
  error?: {
    message: string;
    code?: string;
    details?: SerializableValue;
    retryable: boolean;
  };
  logs?: Array<{
    timestamp: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
  }>;
  metrics?: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
}

export type RunEvent =
  | {
      sequence: number;
      runId: string;
      createdAt: string;
      type: "run.created" | "run.cancel_requested" | "run.completed";
      payload: Record<string, SerializableValue>;
    }
  | {
      sequence: number;
      runId: string;
      createdAt: string;
      type:
        | "node.ready"
        | "node.queued"
        | "node.started"
        | "node.stream.started"
        | "node.stream.delta"
        | "node.stream.finished"
        | "node_materialized_input"
        | "node_attempt_started"
        | "node_attempt_failed"
        | "node_attempt_retried"
        | "node_attempt_succeeded"
        | "node_finalized"
        | "node.retry_scheduled"
        | "node.completed"
        | "node.failed"
        | "node.blocked"
        | "node.skipped"
        | "node.cancelled";
      payload: {
        nodeId: string;
        attemptNumber?: number;
        status: WorkflowRunNodeStatus | WorkflowRunNodeAttemptStatus;
        message?: string;
        reason?: string;
        delta?: string;
        text?: string;
        format?: "plain" | "markdown";
        error?: string;
      };
    };
