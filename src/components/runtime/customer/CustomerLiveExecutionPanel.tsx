"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cx } from "../../../lib/cx";
import { simplifyWorkflowError } from "../../../lib/workflow/simplify-error";
import {
  canonicalSpecId,
  isPremiumAiSpec,
  providerForAiSpec,
} from "../../../lib/workflow/spec-id-aliases";
import type {
  RunStepStatus,
  WorkflowRunLogLine,
  WorkflowRunState,
  WorkflowRunStep,
} from "../../../lib/workflow/run-types";

type ExecutionNodeView = {
  id: string;
  title: string;
  specId: string;
  status: RunStepStatus;
  detail?: string;
  config?: unknown;
  output?: unknown;
  input?: unknown;
  liveText?: string;
  attempts?: Array<{
    attemptNumber: number;
    status: string;
    materializedInput?: unknown;
    outputPayload?: unknown;
    errorPayload?: unknown;
    startedAt?: string | null;
    endedAt?: string | null;
    durationMs?: number | null;
  }>;
  dependencyState?: Array<{ dependencyNodeId: string; status: string }>;
  logs: WorkflowRunLogLine[];
  step?: WorkflowRunStep;
};

type ExecutionTimelineEntry = {
  id: string;
  t: number;
  text: string;
  level: "info" | "warn" | "error";
  nodeId?: string;
};

function humanReadableStep(specId: string, nodeTitle?: string): string {
  const title = nodeTitle || specId;
  const c = canonicalSpecId(specId);
  const map: Record<string, string> = {
    input: "Collecting input data",
    "llm-chat": "Processing with AI",
    "llm-embeddings": "Generating embeddings",
    "llm-image": "Creating image",
    "openai-chat": "Processing with AI",
    "openai-embeddings": "Generating embeddings",
    "openai-image": "Creating image",
    "http-request": "Fetching data",
    merge: "Combining data",
    transform: "Transforming data",
    output: "Preparing output",
  };
  return map[specId] || map[c] || `Executing ${title}`;
}

function sanitizeErrorForDisplay(error?: string | unknown): string {
  if (!error) return "Something went wrong. Try again.";
  return simplifyWorkflowError(error);
}

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0s";
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatRelativeClock(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "Pending";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readSessionPayloadValue(reference: unknown): unknown {
  if (
    reference &&
    typeof reference === "object" &&
    !Array.isArray(reference) &&
    "storageKind" in (reference as Record<string, unknown>)
  ) {
    return (reference as Record<string, unknown>).value;
  }
  return reference;
}

function unwrapInlinePayloadDeep(reference: unknown): unknown {
  let cur: unknown = reference;
  while (
    cur &&
    typeof cur === "object" &&
    !Array.isArray(cur) &&
    "storageKind" in (cur as Record<string, unknown>)
  ) {
    cur = readSessionPayloadValue(cur);
  }
  if (Array.isArray(cur)) return cur.map(unwrapInlinePayloadDeep);
  return cur;
}

function unwrapNodeValueForDisplay(v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const obj = v as Record<string, unknown>;
  if ("value" in obj && "question" in obj) {
    return obj.value;
  }
  if ("__conditionResult" in obj && "__passthrough" in obj) {
    return unwrapNodeValueForDisplay(obj.__passthrough);
  }
  return v;
}

function unwrapMaterializedInputForDisplay(materialized: unknown): unknown {
  const v = unwrapInlinePayloadDeep(readSessionPayloadValue(materialized));
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const rec = v as Record<string, unknown>;
  const ports = rec.ports;
  if (ports && typeof ports === "object" && !Array.isArray(ports)) {
    const portMap = ports as Record<string, unknown>;
    const keys = Object.keys(portMap);
    if (keys.length === 1) {
      const pdata = portMap[keys[0]!];
      if (pdata && typeof pdata === "object" && !Array.isArray(pdata) && "value" in pdata) {
        return unwrapNodeValueForDisplay(
          unwrapInlinePayloadDeep((pdata as Record<string, unknown>).value),
        );
      }
    }
    const out: Record<string, unknown> = {};
    for (const [pid, pdata] of Object.entries(portMap)) {
      if (pdata && typeof pdata === "object" && !Array.isArray(pdata) && "value" in pdata) {
        out[pid] = unwrapNodeValueForDisplay(
          unwrapInlinePayloadDeep((pdata as Record<string, unknown>).value),
        );
      }
    }
    return Object.keys(out).length > 0 ? out : v;
  }
  return unwrapNodeValueForDisplay(v);
}

function sortNodeIdsStable(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function getDeterministicNodeOrder(state: WorkflowRunState): string[] {
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

  const ready = sortNodeIdsStable(nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0));
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) break;
    order.push(current);

    const nextTargets = sortNodeIdsStable(outgoing.get(current) ?? []);
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
    order.push(...sortNodeIdsStable(remaining));
  }

  return order;
}

function getNodeStatusForExecution(
  state: WorkflowRunState,
  nodeId: string,
  specId?: string,
): RunStepStatus {
  const step = state.steps.find((item) => item.id === nodeId);
  if (step?.status) return step.status;

  if (specId === "input" && state.phase !== "input") {
    const hasInputValue =
      state.inputValues && Object.prototype.hasOwnProperty.call(state.inputValues, nodeId);
    return hasInputValue ? "done" : "queued";
  }

  if (state.status === "success" && state.phase === "output") {
    return "done";
  }

  return "queued";
}

function getNodeOutputValue(state: WorkflowRunState, nodeId: string): unknown {
  const sessionNode = state.session?.nodesById?.[nodeId];
  const sessionOutput = readSessionPayloadValue(sessionNode?.outputPayload);
  if (sessionOutput !== undefined) {
    return unwrapNodeValueForDisplay(sessionOutput);
  }
  if (state.outputsByNode && Object.prototype.hasOwnProperty.call(state.outputsByNode, nodeId)) {
    return unwrapNodeValueForDisplay(state.outputsByNode[nodeId]);
  }
  const outputMatch = state.outputs?.find((output) => output.nodeId === nodeId);
  return outputMatch ? unwrapNodeValueForDisplay(outputMatch.value) : undefined;
}

function getNodeResolvedInput(state: WorkflowRunState, nodeId: string, specId?: string): unknown {
  const latestAttempt = state.session?.attemptsByNodeId?.[nodeId]?.slice(-1)[0];
  const materializedInput = readSessionPayloadValue(latestAttempt?.materializedInput);
  if (materializedInput !== undefined) {
    return unwrapMaterializedInputForDisplay(materializedInput);
  }

  const sessionNodeInput = readSessionPayloadValue(
    state.session?.nodesById?.[nodeId]?.inputPayload,
  );
  if (sessionNodeInput !== undefined) {
    return unwrapMaterializedInputForDisplay(sessionNodeInput);
  }

  if (specId === "input") {
    const fromForm = state.inputValues?.[nodeId];
    if (fromForm !== undefined) return fromForm;
    return state.session?.runInput?.[nodeId];
  }

  const edges = state.graph?.edges ?? [];
  const nodes = state.graph?.nodes ?? [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const inbound = [...edges]
    .filter((edge) => edge.target === nodeId)
    .sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`));

  if (inbound.length === 0) return undefined;

  const resolved: Record<string, unknown> = {};
  for (const edge of inbound) {
    const sourceNode = nodeMap.get(edge.source);
    const key =
      sourceNode?.data?.title ||
      sourceNode?.data?.config?.name ||
      sourceNode?.data?.specId ||
      edge.source;

    let rawVal: unknown;
    if (
      state.outputsByNode &&
      Object.prototype.hasOwnProperty.call(state.outputsByNode, edge.source)
    ) {
      rawVal = state.outputsByNode[edge.source];
    } else {
      const upstreamOutput = state.outputs?.find((output) => output.nodeId === edge.source);
      if (upstreamOutput) rawVal = upstreamOutput.value;
    }

    if (rawVal !== undefined) {
      resolved[key] = unwrapNodeValueForDisplay(rawVal);
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function buildExecutionNodes(state: WorkflowRunState): ExecutionNodeView[] {
  const nodeMap = new Map((state.graph?.nodes ?? []).map((node) => [node.id, node]));
  const stepMap = new Map(state.steps.map((step) => [step.id, step]));
  const graphOrder = getDeterministicNodeOrder(state);
  const supplementalIds = state.steps
    .map((step) => step.id)
    .filter((stepId) => !graphOrder.includes(stepId));
  const orderedIds = [...graphOrder, ...supplementalIds];

  return orderedIds.map((nodeId) => {
    const graphNode = nodeMap.get(nodeId);
    const specId = String(graphNode?.data?.specId || "default");
    const step = stepMap.get(nodeId);
    const logs = (state.logs ?? []).filter((log) => log.nodeId === nodeId);
    const detail = step?.detail || logs.find((log) => log.level === "error")?.text;

    return {
      id: nodeId,
      title:
        String(
          graphNode?.data?.title || graphNode?.data?.config?.name || step?.title || "",
        ).trim() || humanReadableStep(specId),
      specId,
      status: getNodeStatusForExecution(state, nodeId, specId),
      detail,
      config: graphNode?.data?.config,
      output: getNodeOutputValue(state, nodeId),
      input: getNodeResolvedInput(state, nodeId, specId),
      liveText: state.liveTextByNode?.[nodeId]?.text,
      attempts: state.session?.attemptsByNodeId?.[nodeId] ?? [],
      dependencyState: state.session?.dependencyStateByNodeId?.[nodeId] ?? [],
      logs,
      step,
    };
  });
}

function buildTimelineEntries(
  state: WorkflowRunState,
  nodes: ExecutionNodeView[],
): ExecutionTimelineEntry[] {
  const items: ExecutionTimelineEntry[] = [];

  for (const node of nodes) {
    if (!node.step?.timestamp) continue;
    const text =
      node.status === "running"
        ? `${node.title} started`
        : node.status === "done"
          ? `${node.title} completed`
          : node.status === "error"
            ? `${node.title} failed`
            : node.status === "cancelled"
              ? `${node.title} cancelled`
              : node.status === "skipped"
                ? `${node.title} skipped`
                : `${node.title} queued`;

    items.push({
      id: `step-${node.id}-${node.status}`,
      t: node.step.timestamp,
      text,
      level: node.status === "error" ? "error" : "info",
      nodeId: node.id,
    });
  }

  for (const [index, log] of (state.logs ?? []).entries()) {
    items.push({
      id: `log-${index}-${log.nodeId ?? "global"}`,
      t: log.t ?? state.startedAt ?? Date.now(),
      text: log.text,
      level: log.level,
      nodeId: log.nodeId,
    });
  }

  return items.sort((a, b) => b.t - a.t);
}

function getStatusBadge(status: RunStepStatus, statusLabel?: string) {
  if (status === "running") {
    return {
      label: statusLabel || "Running",
      className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    };
  }
  if (status === "done") {
    return {
      label: statusLabel || "Completed",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    };
  }
  if (status === "error") {
    return {
      label: statusLabel || "Failed",
      className: "border-red-400/30 bg-red-400/10 text-red-200",
    };
  }
  if (status === "skipped") {
    return {
      label: statusLabel || "Skipped",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }
  if (status === "cancelled") {
    return {
      label: statusLabel || "Cancelled",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }
  return {
    label: statusLabel || "Queued",
    className: "border-white/10 bg-white/5 text-white/65",
  };
}

function ValueCard({
  title,
  value,
  emptyLabel = "Not available for this run.",
}: {
  title: string;
  value: unknown;
  emptyLabel?: string;
}) {
  let content: React.ReactNode;

  if (value === undefined) {
    content = <div className="text-sm text-white/40">{emptyLabel}</div>;
  } else if (typeof value === "string") {
    content = <div className="whitespace-pre-wrap text-sm leading-6 text-white/82">{value}</div>;
  } else {
    let formatted = "";
    try {
      formatted = JSON.stringify(value, null, 2);
    } catch {
      formatted = String(value);
    }
    content = (
      <div className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-white/75">
        {formatted}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </div>
      <div className="mt-3">{content}</div>
    </div>
  );
}

function SpecMeta({ specId }: { specId: string }) {
  const canonical = canonicalSpecId(specId);
  const provider = isPremiumAiSpec(canonical) ? providerForAiSpec(canonical) : null;
  return (
    <div className="mt-1 text-sm text-white/45">
      {canonical}
      {provider ? ` · ${provider}` : ""}
    </div>
  );
}

export default function CustomerLiveExecutionPanel({
  state,
  isStopping,
}: {
  state: WorkflowRunState;
  isStopping?: boolean;
}) {
  const nodes = useMemo(() => buildExecutionNodes(state), [state]);
  const timeline = useMemo(() => buildTimelineEntries(state, nodes), [state, nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const selectedFallbackNodeId = useMemo(() => {
    return (
      state.currentStepId ||
      nodes.find((node) => node.status === "error")?.id ||
      nodes.find((node) => node.status === "running")?.id ||
      nodes[0]?.id ||
      null
    );
  }, [nodes, state.currentStepId]);

  useEffect(() => {
    if (!selectedNodeId || !nodes.some((node) => node.id === selectedNodeId)) {
      queueMicrotask(() => setSelectedNodeId(selectedFallbackNodeId));
      return;
    }
    if (state.currentStepId && state.currentStepId !== selectedNodeId) {
      const currentNode = nodes.find((node) => node.id === state.currentStepId);
      if (currentNode?.status === "running") {
        queueMicrotask(() => setSelectedNodeId(state.currentStepId ?? null));
      }
    }
  }, [nodes, selectedFallbackNodeId, selectedNodeId, state.currentStepId]);

  useEffect(() => {
    if (!state.startedAt || state.finishedAt) return;
    queueMicrotask(() => setNowMs(Date.now()));
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.finishedAt, state.startedAt]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const completedCount = nodes.filter((node) => node.status === "done").length;
  const failedCount = nodes.filter((node) => node.status === "error").length;
  const runningNode = nodes.find((node) => node.status === "running");
  const durationMs = state.startedAt ? (state.finishedAt ?? nowMs) - state.startedAt : 0;
  const runError = sanitizeErrorForDisplay(state.error);

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Status
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {isStopping
                ? "Stopping after current step"
                : state.status === "running"
                  ? "Live execution"
                  : state.status === "success"
                    ? "Run completed"
                    : state.status === "cancelled"
                      ? "Run cancelled"
                      : "Run failed"}
            </div>
            <div className="mt-1 text-sm text-white/55">
              {runningNode
                ? `Currently executing ${runningNode.title}`
                : state.status === "success"
                  ? "All terminal nodes finished."
                  : state.status === "cancelled"
                    ? "Execution stopped before completion."
                    : state.status === "error"
                      ? runError
                      : "Waiting for workflow activity."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Progress
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {completedCount} / {nodes.length} nodes completed
            </div>
            <div className="mt-1 text-sm text-white/55">
              {failedCount > 0
                ? `${failedCount} node${failedCount === 1 ? "" : "s"} failed`
                : `${nodes.filter((node) => node.status === "queued").length} queued`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Runtime
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatDurationMs(durationMs)}
            </div>
            <div className="mt-1 text-sm text-white/55">
              Started {formatRelativeClock(state.startedAt)}
            </div>
          </div>
        </div>

        {state.status === "error" && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {runError}
          </div>
        )}
      </div>

      <div className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="min-h-0 overflow-auto px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Execution graph</div>
              <div className="text-xs text-white/45">
                Every node is shown in deterministic order.
              </div>
            </div>
            <div className="divide-y divide-white/8">
              {nodes.map((node, index) => {
                const badge = getStatusBadge(node.status, node.step?.statusLabel);
                const isSelected = node.id === selectedNode?.id;
                const previewText =
                  typeof node.liveText === "string" && node.liveText.trim()
                    ? node.liveText.trim().slice(0, 96)
                    : typeof node.output === "string" && node.output.trim()
                      ? node.output.trim().slice(0, 96)
                      : null;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={cx(
                      "w-full px-4 py-4 text-left transition-colors",
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xs font-semibold text-white/70">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white">
                            {node.title}
                          </div>
                          <span
                            className={cx(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              badge.className,
                            )}
                          >
                            {node.status === "running" && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-white/45">
                          {node.specId} · {formatRelativeClock(node.step?.timestamp)}
                        </div>

                        {node.detail && (
                          <div className="mt-2 line-clamp-2 text-sm text-white/65">
                            {node.detail}
                          </div>
                        )}

                        {!node.detail && previewText && (
                          <div className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-white/55">
                            {previewText}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">Activity timeline</div>
              <div className="text-xs text-white/45">Newest event first.</div>
            </div>
            <div className="max-h-[360px] overflow-auto px-4 py-3">
              {timeline.length === 0 ? (
                <div className="text-sm text-white/40">No activity has been recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className={cx(
                            "text-sm",
                            entry.level === "error"
                              ? "text-red-200"
                              : entry.level === "warn"
                                ? "text-amber-100"
                                : "text-white/80",
                          )}
                        >
                          {entry.text}
                        </div>
                        <div className="shrink-0 text-[11px] text-white/35">
                          {formatRelativeClock(entry.t)}
                        </div>
                      </div>
                      {entry.nodeId && (
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
                          {entry.nodeId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 border-t border-white/10 lg:border-l lg:border-t-0">
          <div className="h-full overflow-auto px-6 py-5">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Node detail
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold text-white">{selectedNode.title}</div>
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        getStatusBadge(selectedNode.status, selectedNode.step?.statusLabel)
                          .className,
                      )}
                    >
                      {selectedNode.status === "running" && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {getStatusBadge(selectedNode.status, selectedNode.step?.statusLabel).label}
                    </span>
                  </div>
                  <SpecMeta specId={selectedNode.specId} />
                  <div className="mt-1 text-sm text-white/45">{selectedNode.id}</div>
                </div>

                {selectedNode.liveText ? (
                  <ValueCard
                    title="Live text"
                    value={selectedNode.liveText}
                    emptyLabel="No streaming text available."
                  />
                ) : null}
                <ValueCard title="Resolved input" value={selectedNode.input} />
                <ValueCard title="Node config" value={selectedNode.config} />
                <ValueCard title="Node output" value={selectedNode.output} />
                <ValueCard
                  title="Dependency satisfaction"
                  value={
                    selectedNode.dependencyState && selectedNode.dependencyState.length > 0
                      ? selectedNode.dependencyState
                      : undefined
                  }
                  emptyLabel="No upstream dependencies."
                />

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Attempts and timing
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/65">
                    <div>
                      Last state change: {formatRelativeClock(selectedNode.step?.timestamp)}
                    </div>
                    <div>Retries: {Math.max((selectedNode.attempts?.length ?? 1) - 1, 0)}</div>
                    <div>
                      Error:{" "}
                      {selectedNode.detail ? sanitizeErrorForDisplay(selectedNode.detail) : "None"}
                    </div>
                    {selectedNode.attempts && selectedNode.attempts.length > 0 ? (
                      <div>Attempts recorded: {selectedNode.attempts.length}</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Node activity
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedNode.logs.length === 0 ? (
                      <div className="text-sm text-white/40">No node-specific logs recorded.</div>
                    ) : (
                      selectedNode.logs.map((log, index) => (
                        <div
                          key={`${selectedNode.id}-log-${index}`}
                          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                        >
                          <div
                            className={cx(
                              "text-sm",
                              log.level === "error"
                                ? "text-red-200"
                                : log.level === "warn"
                                  ? "text-amber-100"
                                  : "text-white/80",
                            )}
                          >
                            {log.text}
                          </div>
                          <div className="mt-1 text-[11px] text-white/35">
                            {formatRelativeClock(log.t)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/40">
                Select a node to inspect its execution data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
