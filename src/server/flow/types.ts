export type GraphNode = {
  id: string;
  data: {
    specId: string;
    config?: any;
    title?: string;
  };
};

export type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  inputs?: Record<string, unknown>;
  requestMetadata?: {
    userId?: string | null;
    identifier?: string;
    identifierType?: "ip" | "device" | "user";
    workflowId?: string;
  };
};

export type NodeStatus =
  | "idle"
  | "ready"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "timeout"
  | "retrying";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type ExecutionSnapshot = {
  workflowId?: string;
  workflowStatus: WorkflowStatus;
  nodeStatus: Record<string, NodeStatus>;
  outputsByNode: Record<string, unknown>;
  startedAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type RuntimeContext = {
  getInboundValues: (nodeId: string) => unknown[];
  setNodeOutput: (nodeId: string, value: unknown) => void;
  inputs: Record<string, unknown>;
  setNodeStatus?: (nodeId: string, status: NodeStatus) => void;
  setWorkflowStatus?: (status: WorkflowStatus) => void;
  checkpoint?: (snapshot: Partial<ExecutionSnapshot>) => void;
  // Request metadata for rate limiting and tracking
  requestMetadata?: {
    userId?: string | null;
    identifier?: string;
    identifierType?: "ip" | "device" | "user";
    workflowId?: string;
  };
};

export type NodeRuntimeHandler = (node: GraphNode, ctx: RuntimeContext) => Promise<unknown> | unknown;

export type RunLogEntry = {
  type: "start" | "success" | "error" | "retry";
  nodeId: string;
  specId: string;
  message: string;
  timestamp: number; // ms epoch
};

export type RuntimeResult = {
  outputsByNode: Record<string, unknown>;
  finalOutputs: { nodeId: string; value: unknown }[];
  logs: RunLogEntry[];
  nodeStatus: Record<string, NodeStatus>;
  workflowStatus?: WorkflowStatus;
};

/** Progress events for live streaming of workflow execution */
export type FlowProgressEvent =
  | { type: "node_start"; nodeId: string; specId: string; nodeTitle?: string; timestamp: number }
  | { type: "node_done"; nodeId: string; specId: string; nodeTitle?: string; timestamp: number }
  | { type: "node_failed"; nodeId: string; specId: string; nodeTitle?: string; error?: string; timestamp: number }
  | { type: "node_ready"; nodeId: string; specId: string; nodeTitle?: string; timestamp: number };
