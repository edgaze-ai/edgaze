"use client";

import { canonicalSpecId } from "./spec-id-aliases";
import type {
  WorkflowRunConnectionState,
  WorkflowRunGraph,
  WorkflowRunGraphEdge,
  WorkflowRunGraphNode,
  WorkflowRunLiveText,
  WorkflowRunState,
} from "./run-types";

export type CustomerRuntimeMode =
  | "ready"
  | "preparing"
  | "queueing"
  | "node"
  | "streaming"
  | "finalizing"
  | "stopping"
  | "cancelled"
  | "results"
  | "partial_results"
  | "failure";

export type CustomerRuntimeModel = {
  mode: CustomerRuntimeMode;
  title: string;
  headline: string;
  subline?: string;
  elapsedLabel?: string;
  connectionState: WorkflowRunConnectionState;
  activeNodeIds: string[];
  activeNodes: WorkflowRunGraphNode[];
  activeEdges: WorkflowRunGraphEdge[];
  primaryLiveText?: WorkflowRunLiveText;
  outputs: Array<{ nodeId: string; label: string; value: unknown; type?: string }>;
  hasUsefulPartialOutput: boolean;
  canCancel: boolean;
  canClose: boolean;
  longRunning: boolean;
};

export function formatRunElapsed(startedAt?: number, finishedAt?: number): string | undefined {
  if (!startedAt) return undefined;
  const end = finishedAt ?? Date.now();
  const totalSeconds = Math.max(0, Math.round((end - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function toRuntimeGraph(graphLike: any): WorkflowRunGraph | undefined {
  if (!graphLike || typeof graphLike !== "object") return undefined;
  const nodes = Array.isArray(graphLike.nodes)
    ? graphLike.nodes
        .filter((node: any) => node && typeof node.id === "string")
        .map(
          (node: any): WorkflowRunGraphNode => ({
            id: node.id,
            type: typeof node.type === "string" ? node.type : undefined,
            position:
              node.position &&
              typeof node.position.x === "number" &&
              typeof node.position.y === "number"
                ? { x: node.position.x, y: node.position.y }
                : undefined,
            data: {
              ...(node.data ?? {}),
              specId: node.data?.specId,
              title: node.data?.title,
              config: node.data?.config,
            },
          }),
        )
    : [];
  const edges = Array.isArray(graphLike.edges)
    ? graphLike.edges
        .filter(
          (edge: any) => edge && typeof edge.source === "string" && typeof edge.target === "string",
        )
        .map(
          (edge: any): WorkflowRunGraphEdge => ({
            id: typeof edge.id === "string" ? edge.id : undefined,
            source: edge.source,
            target: edge.target,
            sourceHandle: typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
            targetHandle: typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
            type: typeof edge.type === "string" ? edge.type : undefined,
          }),
        )
    : [];

  return nodes.length > 0 || edges.length > 0 ? { nodes, edges } : undefined;
}

export function getRuntimeNodeLabel(node: WorkflowRunGraphNode | undefined): string {
  if (!node) return "Working...";
  const raw =
    (typeof node.data?.title === "string" && node.data.title.trim()) ||
    (typeof node.data?.config?.name === "string" && node.data.config.name.trim()) ||
    canonicalSpecId(String(node.data?.specId ?? node.id));
  return raw || "Working...";
}

function getActiveNodeIds(state: WorkflowRunState): string[] {
  const fromSession = Object.entries(state.session?.nodesById ?? {})
    .filter(([, node]) => node.status === "running")
    .map(([nodeId]) => nodeId);
  if (fromSession.length > 0) return fromSession;

  const fromSteps = state.steps.filter((step) => step.status === "running").map((step) => step.id);
  if (fromSteps.length > 0) return fromSteps;

  if (state.currentStepId) return [state.currentStepId];
  return [];
}

function getQueuedNodeLabel(state: WorkflowRunState): string | undefined {
  const queuedStep = state.steps.find((step) => step.status === "queued");
  if (!queuedStep) return undefined;
  const node = state.graph?.nodes.find((candidate) => candidate.id === queuedStep.id);
  return getRuntimeNodeLabel(node);
}

function getLiveTextForNodeIds(
  state: WorkflowRunState,
  nodeIds: string[],
): WorkflowRunLiveText | undefined {
  const liveEntries = Object.values(state.liveTextByNode ?? {});
  if (liveEntries.length === 0) return undefined;
  const activeMatch = liveEntries.find((entry) => nodeIds.includes(entry.nodeId));
  if (activeMatch) return activeMatch;
  return liveEntries.sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function pickRuntimeOutputs(state: WorkflowRunState) {
  if (state.outputs && state.outputs.length > 0) {
    return state.outputs.map((output, index) => ({
      nodeId: output.nodeId,
      label: output.label && output.label.trim().length > 0 ? output.label : `Output ${index + 1}`,
      value: output.value,
      type: output.type,
    }));
  }

  // Fallback: `outputsByNode` includes *every node* output (including intermediate nodes).
  // For the customer runtime, we only want to expose explicit Workflow Output nodes.
  const outputNodeIds = new Set(
    (state.graph?.nodes ?? [])
      .filter((n) => String(n.data?.specId ?? "") === "output")
      .map((n) => n.id),
  );

  const entries = Object.entries(state.outputsByNode ?? {}).filter(([nodeId]) =>
    outputNodeIds.has(nodeId),
  );

  return entries.map(([nodeId, value], index) => ({
    nodeId,
    label: `Output ${index + 1}`,
    value,
    type: typeof value === "string" ? "string" : "json",
  }));
}

function getVisibleGraph(state: WorkflowRunState, nodeIds: string[]) {
  const graph = state.graph;
  if (!graph) return { activeNodes: [], activeEdges: [] };
  const nodeSet = new Set(nodeIds);
  const activeNodes = graph.nodes.filter((node) => nodeSet.has(node.id));
  const activeEdges = graph.edges.filter(
    (edge) => nodeSet.has(edge.source) || nodeSet.has(edge.target),
  );
  return { activeNodes, activeEdges };
}

function allStepsTerminal(state: WorkflowRunState): boolean {
  return (
    state.steps.length > 0 &&
    state.steps.every((step) => step.status !== "queued" && step.status !== "running")
  );
}

export function deriveCustomerRuntimeModel(
  state: WorkflowRunState | null,
): CustomerRuntimeModel | null {
  if (!state) return null;

  const activeNodeIds = getActiveNodeIds(state).slice(0, 3);
  const { activeNodes, activeEdges } = getVisibleGraph(state, activeNodeIds);
  const primaryLiveText = getLiveTextForNodeIds(state, activeNodeIds);
  const outputs = pickRuntimeOutputs(state);
  const elapsedLabel = formatRunElapsed(state.startedAt, state.finishedAt);
  const connectionState = state.connectionState ?? "idle";
  const now = Date.now();
  const inactiveMs = state.lastEventAt ? now - state.lastEventAt : 0;
  const longRunning =
    state.status === "running" &&
    ((state.startedAt ? now - state.startedAt > 10000 : false) || inactiveMs > 6000);
  const hasUsefulPartialOutput =
    outputs.length > 0 ||
    Object.values(state.liveTextByNode ?? {}).some((entry) => entry.text.trim().length > 0);

  let mode: CustomerRuntimeMode = "ready";
  let headline = "Preparing your run";
  let subline = state.connectionLabel;

  if (state.phase === "input" && state.status === "idle") {
    mode = "ready";
    headline = "Ready to run";
    subline = state.summary;
  } else if (state.status === "cancelling") {
    mode = "stopping";
    headline = "Stopping your run";
    subline = "Waiting for the active node to stop cleanly.";
  } else if (state.status === "cancelled") {
    mode = "cancelled";
    headline = "Run cancelled";
    subline = hasUsefulPartialOutput
      ? "Anything already completed is still available below."
      : undefined;
  } else if (state.status === "success") {
    if (outputs.length > 0) {
      mode = "results";
      headline = "Results ready";
      subline =
        outputs.length > 1 ? `${outputs.length} outputs are ready.` : "Your run has completed.";
    } else {
      // Workflows without Workflow Output nodes should not show the full "Results" surface.
      mode = "finalizing";
      headline = "Run completed";
      subline = "This workflow finished successfully.";
    }
  } else if (state.status === "error" && hasUsefulPartialOutput) {
    mode = "partial_results";
    headline = "Partial results available";
    subline =
      state.error || "The run did not finish cleanly, but completed output is still available.";
  } else if (state.status === "error") {
    mode = "failure";
    headline = "Run failed";
    subline = state.error || "The workflow stopped before any final result was produced.";
  } else if (
    (primaryLiveText?.status === "streaming" || primaryLiveText?.status === "committed") &&
    primaryLiveText.text
  ) {
    mode = "streaming";
    headline = getRuntimeNodeLabel(activeNodes[0]);
    subline = connectionState === "reconnecting" ? "Reconnecting to live updates..." : undefined;
  } else if (activeNodeIds.length > 0) {
    mode = "node";
    headline = getRuntimeNodeLabel(activeNodes[0]);
    subline =
      connectionState === "reconnecting"
        ? "Reconnecting to live updates..."
        : longRunning
          ? "This node is taking a little longer than usual."
          : undefined;
  } else if (allStepsTerminal(state) && state.status === "running") {
    mode = "finalizing";
    headline = "Preparing your results";
    subline = "Final output is being assembled.";
  } else if (state.status === "running" && state.lastEventSequence && state.lastEventSequence > 0) {
    mode = "queueing";
    headline = "Preparing next node";
    const nextNodeLabel = getQueuedNodeLabel(state);
    subline =
      connectionState === "reconnecting"
        ? "Reconnecting to live updates..."
        : nextNodeLabel
          ? `Up next: ${nextNodeLabel}`
          : longRunning
            ? "Still progressing through the workflow."
            : undefined;
  } else if (
    state.status === "running" &&
    (connectionState === "live" || connectionState === "reconnecting" || Boolean(state.runId))
  ) {
    mode = "queueing";
    headline = "Initializing your workflow";
    subline =
      connectionState === "reconnecting"
        ? "Reconnecting to live updates..."
        : "Connected. Waiting for the first step to start.";
  } else {
    mode = "preparing";
    headline = "We are preparing your run";
    subline =
      connectionState === "connecting"
        ? "Connecting to the execution stream..."
        : state.connectionLabel;
  }

  return {
    mode,
    title: state.workflowName,
    headline,
    subline,
    elapsedLabel,
    connectionState,
    activeNodeIds,
    activeNodes,
    activeEdges,
    primaryLiveText,
    outputs,
    hasUsefulPartialOutput,
    canCancel: state.status === "running" || state.status === "cancelling",
    canClose: state.status !== "running" && state.status !== "cancelling",
    longRunning,
  };
}
