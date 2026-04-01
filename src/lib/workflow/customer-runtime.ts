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

/** Kahn topo order aligned with builder run modal — stable tie-break by id. */
function topologicalWorkflowNodeOrder(state: WorkflowRunState): string[] {
  const graphNodes = state.graph?.nodes ?? [];
  const graphEdges = state.graph?.edges ?? [];
  if (!graphNodes.length) {
    return state.steps.map((step) => step.id);
  }

  const nodeIds = graphNodes.map((node) => node.id);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const nodeId of nodeIds) {
    indegree.set(nodeId, 0);
    outgoing.set(nodeId, []);
  }

  for (const edge of graphEdges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const ready = [...nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)].sort((a, b) =>
    a.localeCompare(b),
  );
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) break;
    order.push(current);

    const nextTargets = [...(outgoing.get(current) ?? [])].sort((a, b) => a.localeCompare(b));
    for (const target of nextTargets) {
      const nextDegree = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) {
        ready.push(target);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  const remaining = nodeIds.filter((nodeId) => !order.includes(nodeId));
  if (remaining.length > 0) {
    order.push(...[...remaining].sort((a, b) => a.localeCompare(b)));
  }

  return order;
}

function getActiveNodeIds(state: WorkflowRunState): string[] {
  const fromSteps = state.steps.filter((step) => step.status === "running").map((step) => step.id);
  const fromSession = Object.entries(state.session?.nodesById ?? {})
    .filter(([, node]) => node.status === "running")
    .map(([nodeId]) => nodeId);

  const streamingNodeIds = Object.values(state.liveTextByNode ?? {})
    .filter((e) => e.status === "streaming")
    .map((e) => e.nodeId);

  let candidates: string[] =
    fromSteps.length > 0 ? fromSteps : fromSession.length > 0 ? [...fromSession] : [];

  if (streamingNodeIds.length > 0) {
    const tiedToDeclared = streamingNodeIds.filter(
      (id) => candidates.length === 0 || candidates.includes(id),
    );
    if (tiedToDeclared.length > 0) {
      candidates = tiedToDeclared;
    } else {
      candidates = [...candidates, ...streamingNodeIds];
    }
  }

  const graphNodes = state.graph?.nodes ?? [];
  const graphIdSet = new Set(graphNodes.map((n) => n.id));
  if (graphIdSet.size > 0) {
    candidates = candidates.filter((id) => graphIdSet.has(id));
  }

  if (candidates.length === 0 && state.currentStepId) {
    if (graphIdSet.size === 0 || graphIdSet.has(state.currentStepId)) {
      return [state.currentStepId];
    }
  }
  if (candidates.length === 0) {
    const runningInGraph = state.steps
      .filter((s) => s.status === "running" && (graphIdSet.size === 0 || graphIdSet.has(s.id)))
      .map((s) => s.id);
    if (runningInGraph.length > 0) return runningInGraph.slice(0, 3);
    return [];
  }

  const specById = new Map(
    (state.graph?.nodes ?? []).map((n) => [n.id, String(n.data?.specId ?? "")]),
  );

  const nonOutput = candidates.filter((id) => specById.get(id) !== "output");
  if (nonOutput.length > 0) {
    candidates = nonOutput;
  }

  const order = topologicalWorkflowNodeOrder(state);
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...candidates].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}

function getQueuedNodeLabel(state: WorkflowRunState): string | undefined {
  const queuedStep = state.steps.find((step) => step.status === "queued");
  if (!queuedStep) return undefined;
  const node = state.graph?.nodes.find((candidate) => candidate.id === queuedStep.id);
  return getRuntimeNodeLabel(node);
}

function getQueuedNodeIds(state: WorkflowRunState): string[] {
  return state.steps
    .filter((step) => step.status === "queued")
    .map((step) => step.id)
    .slice(0, 3);
}

function getInitialVisibleNodeIds(state: WorkflowRunState): string[] {
  const order = topologicalWorkflowNodeOrder(state);
  const graphNodeById = new Map((state.graph?.nodes ?? []).map((node) => [node.id, node]));
  const preferred = order.filter((nodeId) => {
    const node = graphNodeById.get(nodeId);
    return node && String(node.data?.specId ?? "") !== "output";
  });
  const fallback = preferred.length > 0 ? preferred : order;
  return fallback.slice(0, 3);
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

function hasQueuedSteps(state: WorkflowRunState): boolean {
  return state.steps.some((step) => step.status === "queued");
}

export function deriveCustomerRuntimeModel(
  state: WorkflowRunState | null,
): CustomerRuntimeModel | null {
  if (!state) return null;

  const runningNodeIds = getActiveNodeIds(state).slice(0, 3);
  const queuedNodeIds = runningNodeIds.length === 0 ? getQueuedNodeIds(state) : [];
  const initialNodeIds =
    runningNodeIds.length === 0 && queuedNodeIds.length === 0 && state.status === "running"
      ? getInitialVisibleNodeIds(state)
      : [];
  const activeNodeIds =
    runningNodeIds.length > 0
      ? runningNodeIds
      : queuedNodeIds.length > 0
        ? queuedNodeIds
        : initialNodeIds;
  const { activeNodes, activeEdges } = getVisibleGraph(state, activeNodeIds);
  const primaryLiveText = getLiveTextForNodeIds(state, runningNodeIds);
  const outputs = pickRuntimeOutputs(state);
  const elapsedLabel = formatRunElapsed(state.startedAt, state.finishedAt);
  const connectionState = state.connectionState ?? "idle";
  const displayNodeLabel = getRuntimeNodeLabel(activeNodes[0]);
  const now = Date.now();
  const inactiveMs = state.lastEventAt ? now - state.lastEventAt : 0;
  const longRunning =
    state.status === "running" &&
    ((state.startedAt ? now - state.startedAt > 10000 : false) || inactiveMs > 6000);
  const hasUsefulPartialOutput =
    outputs.length > 0 ||
    Object.values(state.liveTextByNode ?? {}).some((entry) => entry.text.trim().length > 0);

  let mode: CustomerRuntimeMode = "ready";
  let headline = state.workflowName || "Workflow";
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
  } else if (runningNodeIds.length > 0) {
    mode = "node";
    headline = getRuntimeNodeLabel(activeNodes[0]);
    subline =
      connectionState === "reconnecting"
        ? "Reconnecting to live updates..."
        : longRunning
          ? "This node is taking a little longer than usual."
          : undefined;
  } else if (queuedNodeIds.length > 0) {
    mode = "queueing";
    headline = displayNodeLabel;
    const nextNodeLabel = getQueuedNodeLabel(state);
    subline =
      connectionState === "reconnecting"
        ? "Reconnecting to live updates..."
        : nextNodeLabel
          ? `Up next: ${nextNodeLabel}`
          : undefined;
  } else if (initialNodeIds.length > 0) {
    mode = "queueing";
    headline = displayNodeLabel;
    subline = connectionState === "reconnecting" ? "Reconnecting to live updates..." : undefined;
  } else if (allStepsTerminal(state) && state.status === "running") {
    mode = "finalizing";
    headline = "Preparing your results";
    subline = "Final output is being assembled.";
  } else if (
    state.status === "running" &&
    (hasQueuedSteps(state) || Boolean(state.lastEventSequence))
  ) {
    mode = "queueing";
    headline = getQueuedNodeLabel(state) || displayNodeLabel;
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
    (connectionState === "live" ||
      connectionState === "reconnecting" ||
      connectionState === "connecting" ||
      Boolean(state.runId))
  ) {
    mode = "queueing";
    headline = displayNodeLabel;
    subline = connectionState === "reconnecting" ? "Reconnecting to live updates..." : undefined;
  } else {
    mode = "queueing";
    headline = state.status === "running" ? displayNodeLabel : "Ready to run";
    subline = state.status === "running" ? state.connectionLabel : state.summary;
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
