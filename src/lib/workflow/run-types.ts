"use client";

import type { ReactNode } from "react";

export type RunPhase = "input" | "executing" | "output";

export type RunStepStatus = "queued" | "running" | "done" | "error" | "skipped" | "cancelled";

export type WorkflowRunStep = {
  id: string;
  title: string;
  detail?: string;
  status: RunStepStatus;
  statusLabel?: string;
  icon?: ReactNode;
  timestamp?: number;
};

export type WorkflowRunLogLine = {
  t: number;
  level: "info" | "warn" | "error";
  text: string;
  nodeId?: string;
  specId?: string;
};

export type WorkflowInput = {
  nodeId: string;
  specId: string;
  name: string;
  description?: string;
  type: "text" | "number" | "textarea" | "url" | "file" | "json";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
};

export type WorkflowRunConnectionState =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "degraded"
  | "offline";

export type WorkflowRunLiveText = {
  nodeId: string;
  text: string;
  format: "plain" | "markdown";
  status: "streaming" | "committed" | "interrupted";
  updatedAt: number;
  completedAt?: number;
  error?: string;
  sequence?: number;
};

export type WorkflowRunGraphNode = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: {
    specId?: string;
    title?: string;
    config?: any;
    [key: string]: unknown;
  };
};

export type WorkflowRunGraphEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
};

export type WorkflowRunGraph = {
  nodes: WorkflowRunGraphNode[];
  edges: WorkflowRunGraphEdge[];
};

export type WorkflowRunState = {
  runId?: string;
  runAccessToken?: string;
  workflowId: string;
  workflowName: string;
  phase: RunPhase;
  status: "idle" | "running" | "cancelling" | "success" | "error" | "cancelled";
  startedAt?: number;
  finishedAt?: number;
  steps: WorkflowRunStep[];
  currentStepId?: string | null;
  logs: WorkflowRunLogLine[];
  summary?: string;
  inputs?: WorkflowInput[];
  inputValues?: Record<string, any>;
  outputs?: Array<{ nodeId: string; label: string; value: any; type?: string }>;
  outputsByNode?: Record<string, unknown>;
  error?: string;
  graph?: WorkflowRunGraph;
  session?: {
    /** Authoritative per-node workflow inputs from workflow_runs.run_input (v2). */
    runInput?: Record<string, unknown>;
    nodesById?: Record<
      string,
      {
        status: string;
        inputPayload?: unknown;
        outputPayload?: unknown;
        errorPayload?: unknown;
      }
    >;
    attemptsByNodeId?: Record<
      string,
      Array<{
        attemptNumber: number;
        status: string;
        materializedInput?: unknown;
        outputPayload?: unknown;
        errorPayload?: unknown;
        startedAt?: string | null;
        endedAt?: string | null;
        durationMs?: number | null;
      }>
    >;
    dependencyStateByNodeId?: Record<
      string,
      Array<{ dependencyNodeId: string; status: "satisfied" | "failed" | "skipped" | "cancelled" | "pending" }>
    >;
  };
  connectionState?: WorkflowRunConnectionState;
  connectionLabel?: string;
  lastEventAt?: number;
  lastEventSequence?: number;
  liveTextByNode?: Record<string, WorkflowRunLiveText>;
};
