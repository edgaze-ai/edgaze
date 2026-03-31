import type { WorkflowRunGraph, WorkflowRunState, WorkflowRunStep } from "./run-types";
import type { RunSessionBootstrapResponse, RunSessionStreamEvent } from "./run-session";

function readPayloadValue(reference: unknown) {
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

function mergeRuntimeGraphLayout(params: {
  compiledNodes: Array<{
    id: string;
    specId?: string;
    title?: string;
    config?: any;
  }>;
  compiledEdges: Array<{ sourceNodeId: string; targetNodeId: string; id?: string }>;
  sourceGraph?: WorkflowRunGraph;
}): WorkflowRunGraph {
  const sourceNodeById = new Map((params.sourceGraph?.nodes ?? []).map((node) => [node.id, node]));
  const sourceEdgeByKey = new Map(
    (params.sourceGraph?.edges ?? []).map((edge) => [
      `${edge.source}:${edge.target}:${edge.sourceHandle ?? ""}:${edge.targetHandle ?? ""}`,
      edge,
    ]),
  );

  return {
    nodes: params.compiledNodes.map((node) => {
      const sourceNode = sourceNodeById.get(node.id);
      return {
        id: node.id,
        type: sourceNode?.type,
        position: sourceNode?.position,
        data: {
          ...(sourceNode?.data ?? {}),
          specId: node.specId ?? sourceNode?.data?.specId,
          title: node.title ?? sourceNode?.data?.title,
          config: node.config ?? sourceNode?.data?.config,
        },
      };
    }),
    edges: params.compiledEdges.map((edge) => {
      const sourceEdge =
        sourceEdgeByKey.get(`${edge.sourceNodeId}:${edge.targetNodeId}::`) ??
        (params.sourceGraph?.edges ?? []).find(
          (candidate) =>
            candidate.source === edge.sourceNodeId && candidate.target === edge.targetNodeId,
        );
      return {
        id: sourceEdge?.id ?? edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: sourceEdge?.sourceHandle,
        targetHandle: sourceEdge?.targetHandle,
        type: sourceEdge?.type,
      };
    }),
  };
}

export function mapV2StatusToStepStatus(
  status: string,
): "queued" | "running" | "done" | "error" | "skipped" | "cancelled" {
  const statusMap: Record<
    string,
    "queued" | "running" | "done" | "error" | "skipped" | "cancelled"
  > = {
    pending: "queued",
    ready: "queued",
    queued: "queued",
    retry_scheduled: "queued",
    running: "running",
    cancelling: "running",
    completed: "done",
    failed: "error",
    timed_out: "error",
    blocked: "skipped",
    skipped: "skipped",
    cancelled: "cancelled",
  };
  return statusMap[status] ?? "queued";
}

export function buildStepPresentation(params: {
  status: string;
  latestStatusEvent?: Record<string, any>;
}): { detail?: string; statusLabel?: string } {
  const message =
    typeof params.latestStatusEvent?.payload?.message === "string"
      ? String(params.latestStatusEvent.payload.message)
      : undefined;
  const reason =
    typeof params.latestStatusEvent?.payload?.reason === "string"
      ? String(params.latestStatusEvent.payload.reason)
      : undefined;

  if (params.status === "skipped" || params.status === "blocked") {
    if (reason === "condition_path_closed" || reason === "condition_branch_not_taken") {
      return {
        detail:
          message ?? "This branch was not taken because the condition resolved the other way.",
        statusLabel: "Condition off",
      };
    }
    if (reason === "upstream_failed_fast") {
      return {
        detail: message ?? "This branch was skipped because an upstream node failed fast.",
        statusLabel: "Skipped downstream",
      };
    }
    if (reason === "upstream_failure_policy" || reason === "upstream_path_closed") {
      return {
        detail: message,
        statusLabel: "Skipped downstream",
      };
    }
  }

  return {
    detail: message,
  };
}

function appendLogLine(params: {
  state: WorkflowRunState;
  event: RunSessionStreamEvent;
}): WorkflowRunState["logs"] {
  if (
    params.event.type === "node.stream.started" ||
    params.event.type === "node.stream.delta" ||
    params.event.type === "node.stream.finished"
  ) {
    return params.state.logs;
  }

  const nodeId =
    typeof params.event.payload?.nodeId === "string" ? params.event.payload.nodeId : undefined;
  const specId =
    nodeId && params.state.graph?.nodes
      ? params.state.graph.nodes.find((node) => node.id === nodeId)?.data?.specId
      : undefined;
  const level =
    params.event.type === "node.failed" || params.event.type === "node_attempt_failed"
      ? "error"
      : params.event.type === "node.cancelled" ||
          params.event.type === "node.blocked" ||
          params.event.type === "node.skipped" ||
          params.event.type === "run.cancel_requested"
        ? "warn"
        : "info";

  return [
    ...params.state.logs,
    {
      t: Date.parse(String(params.event.createdAt ?? "")) || Date.now(),
      level,
      text:
        typeof params.event.payload?.message === "string" &&
        params.event.payload.message.trim().length > 0
          ? params.event.payload.message
          : params.event.type,
      nodeId,
      specId,
    },
  ];
}

function applyLiveTextEvent(params: {
  state: WorkflowRunState;
  event: RunSessionStreamEvent;
}): WorkflowRunState["liveTextByNode"] {
  const nodeId =
    typeof params.event.payload?.nodeId === "string"
      ? String(params.event.payload.nodeId)
      : undefined;
  if (!nodeId) return params.state.liveTextByNode;

  const existing = params.state.liveTextByNode?.[nodeId];
  const current = params.state.liveTextByNode ?? {};
  const textDelta =
    typeof params.event.payload?.delta === "string"
      ? params.event.payload.delta
      : typeof params.event.payload?.text === "string"
        ? params.event.payload.text
        : "";

  if (params.event.type === "node.stream.started") {
    return {
      ...current,
      [nodeId]: {
        nodeId,
        text: existing?.text ?? "",
        format: params.event.payload?.format === "plain" ? "plain" : "markdown",
        status: "streaming",
        updatedAt: Date.now(),
        sequence: params.event.sequence,
      },
    };
  }

  if (params.event.type === "node.stream.delta") {
    if (
      typeof params.event.sequence === "number" &&
      typeof existing?.sequence === "number" &&
      params.event.sequence <= existing.sequence
    ) {
      return current;
    }

    return {
      ...current,
      [nodeId]: {
        nodeId,
        text: `${existing?.text ?? ""}${textDelta}`,
        format:
          params.event.payload?.format === "plain" ? "plain" : (existing?.format ?? "markdown"),
        status: "streaming",
        updatedAt: Date.now(),
        sequence: params.event.sequence,
      },
    };
  }

  if (params.event.type === "node.stream.finished") {
    return {
      ...current,
      [nodeId]: {
        nodeId,
        text:
          typeof params.event.payload?.text === "string"
            ? params.event.payload.text
            : (existing?.text ?? ""),
        format:
          params.event.payload?.format === "plain" ? "plain" : (existing?.format ?? "markdown"),
        status:
          params.event.payload?.status === "interrupted" ||
          params.event.payload?.status === "failed" ||
          params.event.payload?.status === "cancelled"
            ? "interrupted"
            : "committed",
        updatedAt: Date.now(),
        completedAt: Date.now(),
        error:
          typeof params.event.payload?.error === "string" ? params.event.payload.error : undefined,
        sequence: params.event.sequence,
      },
    };
  }

  return params.state.liveTextByNode;
}

function applyNodeStatusEvent(params: {
  state: WorkflowRunState;
  nodeId: string;
  rawStatus: string;
  event: RunSessionStreamEvent;
}): WorkflowRunStep[] {
  const presentation = buildStepPresentation({
    status: params.rawStatus,
    latestStatusEvent: params.event as Record<string, unknown>,
  });

  return params.state.steps.map((step) =>
    step.id === params.nodeId
      ? {
          ...step,
          status: mapV2StatusToStepStatus(params.rawStatus),
          detail: presentation.detail ?? step.detail,
          statusLabel: presentation.statusLabel,
          timestamp: Date.now(),
        }
      : step,
  );
}

function mapRunEventToWorkflowStatus(
  event: RunSessionStreamEvent,
): WorkflowRunState["status"] | null {
  if (event.type === "run.cancel_requested") {
    return "cancelling";
  }
  if (event.type !== "run.completed") {
    return null;
  }

  const status = typeof event.payload?.status === "string" ? event.payload.status : undefined;
  const outcome = typeof event.payload?.outcome === "string" ? event.payload.outcome : undefined;
  if (status === "cancelled" || outcome === "cancelled") return "cancelled";
  if (status === "failed" || outcome === "failed" || outcome === "completed_with_errors")
    return "error";
  return "success";
}

export function applyWorkflowRunEventToState(params: {
  state: WorkflowRunState;
  event: RunSessionStreamEvent;
}): WorkflowRunState {
  const nodeId =
    typeof params.event.payload?.nodeId === "string" ? params.event.payload.nodeId : undefined;
  const rawStatus =
    typeof params.event.payload?.status === "string"
      ? params.event.payload.status
      : params.event.type === "node.started" || params.event.type === "node_attempt_started"
        ? "running"
        : params.event.type === "node.ready" || params.event.type === "node.queued"
          ? "ready"
          : params.event.type === "node.completed" || params.event.type === "node_attempt_succeeded"
            ? "completed"
            : params.event.type === "node.failed" || params.event.type === "node_attempt_failed"
              ? "failed"
              : params.event.type === "node.skipped" || params.event.type === "node.blocked"
                ? "skipped"
                : params.event.type === "node.cancelled"
                  ? "cancelled"
                  : undefined;

  const steps =
    nodeId && rawStatus
      ? applyNodeStatusEvent({
          state: params.state,
          nodeId,
          rawStatus,
          event: params.event,
        })
      : params.state.steps;

  const nextStatus = mapRunEventToWorkflowStatus(params.event) ?? params.state.status;
  const terminal = nextStatus === "success" || nextStatus === "error" || nextStatus === "cancelled";
  const logs = appendLogLine(params);
  const liveTextByNode = applyLiveTextEvent(params);

  return {
    ...params.state,
    phase: terminal ? "output" : params.state.phase,
    status: nextStatus,
    steps,
    currentStepId:
      nodeId && rawStatus === "running"
        ? nodeId
        : nodeId && params.state.currentStepId === nodeId && rawStatus !== "running"
          ? null
          : (steps.find((step) => step.status === "running")?.id ?? null),
    logs,
    liveTextByNode,
    connectionState:
      params.state.connectionState === "reconnecting" ? "live" : params.state.connectionState,
    connectionLabel: undefined,
    lastEventAt: Date.now(),
    lastEventSequence:
      typeof params.event.sequence === "number"
        ? Math.max(params.state.lastEventSequence ?? 0, params.event.sequence)
        : params.state.lastEventSequence,
    error:
      nextStatus === "error"
        ? typeof params.event.payload?.message === "string"
          ? params.event.payload.message
          : logs.find((log) => log.level === "error")?.text
        : params.state.error,
    summary:
      nextStatus === "cancelled"
        ? "Workflow cancelled"
        : nextStatus === "success"
          ? "Workflow executed successfully"
          : params.state.summary,
    finishedAt: terminal ? Date.now() : params.state.finishedAt,
  };
}

export function buildWorkflowRunStateFromBootstrap(params: {
  bootstrap: RunSessionBootstrapResponse;
  workflowId: string;
  workflowName: string;
  inputValues?: Record<string, any>;
  runAccessToken?: string | null;
  sourceGraph?: WorkflowRunGraph;
}): Partial<WorkflowRunState> {
  const compiled = (params.bootstrap.run.compiledWorkflowSnapshot ?? {}) as {
    nodes?: Array<{
      id: string;
      specId?: string;
      title?: string;
      config?: any;
      topoIndex?: number;
      outputPorts?: Array<{ id: string }>;
    }>;
    edges?: Array<{ sourceNodeId: string; targetNodeId: string }>;
  };

  const compiledNodes = [...(compiled.nodes ?? [])].sort(
    (left, right) => Number(left.topoIndex ?? 0) - Number(right.topoIndex ?? 0),
  );
  const compiledNodeById = new Map(compiledNodes.map((node) => [node.id, node]));
  const nodeRows = (params.bootstrap.nodes ?? []) as Array<Record<string, any>>;
  const nodeStatusById = new Map(
    nodeRows.map((node) => [String(node.nodeId), String(node.status ?? "pending")]),
  );

  const unwrapNodeOutputValue = (nodeId: string, rawValue: unknown) => {
    const compiledNode = compiledNodeById.get(nodeId);
    if (!compiledNode || rawValue === undefined || rawValue === null) return rawValue;
    if (typeof rawValue !== "object" || Array.isArray(rawValue)) return rawValue;

    const outputRecord = rawValue as Record<string, unknown>;
    if (!compiledNode.outputPorts || compiledNode.outputPorts.length === 0) {
      return outputRecord.__result__ ?? rawValue;
    }
    if (compiledNode.outputPorts.length === 1) {
      const onlyPort = compiledNode.outputPorts[0];
      return onlyPort ? (outputRecord[onlyPort.id] ?? rawValue) : rawValue;
    }
    return rawValue;
  };

  const outputsByNode: Record<string, unknown> = {};
  for (const node of nodeRows) {
    const nodeId = String(node.nodeId);
    const rawOutput = readPayloadValue(node.outputPayload);
    if (rawOutput !== undefined) {
      outputsByNode[nodeId] = unwrapNodeOutputValue(nodeId, rawOutput);
    }
  }

  const events = (params.bootstrap.events ?? []) as Array<Record<string, any>>;
  const steps: WorkflowRunStep[] = compiledNodes.map((node) => {
    const status = nodeStatusById.get(node.id) ?? "pending";
    const latestStatusEvent = [...events].reverse().find((event) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      return (
        payload.nodeId === node.id &&
        (event.type === "node.failed" ||
          event.type === "node_attempt_failed" ||
          event.type === "node.blocked" ||
          event.type === "node.skipped" ||
          event.type === "node.cancelled")
      );
    });
    const presentation = buildStepPresentation({
      status,
      latestStatusEvent,
    });

    return {
      id: node.id,
      title: node.title || node.specId || node.id,
      status: mapV2StatusToStepStatus(status),
      detail: presentation.detail,
      statusLabel: presentation.statusLabel,
      timestamp: Date.now(),
    };
  });

  const logs = events.map((event) => ({
    t: Date.parse(String(event.createdAt ?? "")) || Date.now(),
    level:
      event.type === "node.failed" || event.type === "node_attempt_failed"
        ? ("error" as const)
        : event.type === "node.cancelled" ||
            event.type === "node.blocked" ||
            event.type === "node.skipped"
          ? ("warn" as const)
          : ("info" as const),
    text:
      typeof event.payload?.message === "string" && event.payload.message.trim().length > 0
        ? event.payload.message
        : String(event.type),
    nodeId: typeof event.payload?.nodeId === "string" ? event.payload.nodeId : undefined,
    specId:
      typeof event.payload?.nodeId === "string"
        ? compiledNodeById.get(event.payload.nodeId)?.specId
        : undefined,
  }));
  const liveTextByNode = events.reduce<NonNullable<WorkflowRunState["liveTextByNode"]>>(
    (acc, rawEvent) =>
      applyLiveTextEvent({
        state: { liveTextByNode: acc } as WorkflowRunState,
        event: rawEvent as RunSessionStreamEvent,
      }) ?? acc,
    {},
  );

  const runStatus = String(params.bootstrap.run.status ?? "");
  const outcome = String(params.bootstrap.run.outcome ?? "");
  const isTerminal =
    runStatus === "completed" || runStatus === "failed" || runStatus === "cancelled";
  const isCancelled = runStatus === "cancelled" || outcome === "cancelled";
  const hasError =
    runStatus === "failed" || outcome === "failed" || logs.some((log) => log.level === "error");

  const rawErrorDetails = params.bootstrap.run?.errorDetails;
  const errorDetailsRecord =
    rawErrorDetails && typeof rawErrorDetails === "object" && !Array.isArray(rawErrorDetails)
      ? (rawErrorDetails as Record<string, unknown>)
      : null;
  const runLevelErrorMessage =
    typeof errorDetailsRecord?.message === "string" ? errorDetailsRecord.message.trim() : "";
  const runLevelErrorCode =
    typeof errorDetailsRecord?.code === "string" ? errorDetailsRecord.code.trim() : "";

  const logErrorText = logs.find((log) => log.level === "error")?.text;
  const resolvedRunError =
    hasError && (logErrorText || runLevelErrorMessage || runLevelErrorCode)
      ? logErrorText ||
        runLevelErrorMessage ||
        (runLevelErrorCode === "runner_stalled"
          ? "Workflow runner stalled before any step executed."
          : runLevelErrorCode || "Workflow run failed.")
      : undefined;

  let finalSteps = steps;
  if (isTerminal && hasError && !isCancelled) {
    const stepStopDetail =
      runLevelErrorMessage ||
      (runLevelErrorCode === "runner_stalled"
        ? "Run stopped: engine could not claim or execute steps."
        : "Run failed before this step completed.");
    finalSteps = steps.map((step) =>
      step.status === "queued" || step.status === "running"
        ? {
            ...step,
            status: "error" as const,
            detail: stepStopDetail,
            statusLabel: "Stopped",
          }
        : step,
    );
  }

  const outputs = compiledNodes
    .filter((node) => node.specId === "output")
    .map((node) => {
      const value = outputsByNode[node.id];
      if (value === undefined) return null;
      return {
        nodeId: node.id,
        label: node.title || "Output",
        value,
        type: typeof value === "string" ? "string" : "json",
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const attemptsByNodeId = ((params.bootstrap.attempts ?? []) as Array<Record<string, any>>).reduce<
    Record<string, Array<any>>
  >((acc, attempt) => {
    const nodeId = String(attempt.nodeId ?? "");
    if (!acc[nodeId]) acc[nodeId] = [];
    acc[nodeId].push({
      attemptNumber: Number(attempt.attemptNumber ?? 0),
      status: String(attempt.status ?? "running"),
      materializedInput: attempt.materializedInput,
      outputPayload: attempt.outputPayload,
      errorPayload: attempt.errorPayload,
      startedAt: typeof attempt.startedAt === "string" ? attempt.startedAt : null,
      endedAt: typeof attempt.endedAt === "string" ? attempt.endedAt : null,
      durationMs: typeof attempt.durationMs === "number" ? attempt.durationMs : null,
    });
    return acc;
  }, {});
  const dependencyStateByNodeId = Object.fromEntries(
    Object.entries(params.bootstrap.dependencyStateByNodeId ?? {}).map(([nodeId, dependencies]) => [
      nodeId,
      ((dependencies ?? []) as Array<Record<string, unknown>>).map((dependency) => ({
        dependencyNodeId: String(dependency.dependencyNodeId ?? ""),
        status: (dependency.status ?? "pending") as
          | "satisfied"
          | "failed"
          | "skipped"
          | "cancelled"
          | "pending",
      })),
    ]),
  ) as Record<
    string,
    Array<{
      dependencyNodeId: string;
      status: "satisfied" | "failed" | "skipped" | "cancelled" | "pending";
    }>
  >;

  return {
    runId: String(params.bootstrap.run.id ?? ""),
    runAccessToken: params.runAccessToken ?? undefined,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    phase: isTerminal ? "output" : "executing",
    status: isTerminal
      ? isCancelled
        ? "cancelled"
        : hasError
          ? "error"
          : "success"
      : runStatus === "cancelling"
        ? "cancelling"
        : "running",
    steps: finalSteps,
    currentStepId: finalSteps.find((step) => step.status === "running")?.id ?? null,
    logs,
    outputsByNode,
    outputs: isTerminal ? outputs : undefined,
    error: resolvedRunError,
    finishedAt: isTerminal
      ? Date.parse(String(params.bootstrap.run.finalizedAt ?? "")) || Date.now()
      : undefined,
    inputValues: params.inputValues,
    connectionState: isTerminal ? "idle" : "live",
    connectionLabel: undefined,
    lastEventAt: Date.now(),
    lastEventSequence: Number(params.bootstrap.run.lastEventSequence ?? 0),
    liveTextByNode,
    graph: mergeRuntimeGraphLayout({
      compiledNodes,
      compiledEdges: compiled.edges ?? [],
      sourceGraph: params.sourceGraph,
    }),
    session: {
      runInput:
        (params.bootstrap.run?.runInput as Record<string, unknown> | null | undefined) ?? undefined,
      nodesById: Object.fromEntries(
        nodeRows.map((node) => [
          String(node.nodeId),
          {
            status: String(node.status ?? "pending"),
            inputPayload: node.inputPayload,
            outputPayload: node.outputPayload,
            errorPayload: node.errorPayload,
          },
        ]),
      ),
      attemptsByNodeId,
      dependencyStateByNodeId,
    },
    summary: isTerminal
      ? isCancelled
        ? "Workflow cancelled"
        : hasError
          ? "Run failed"
          : "Workflow executed successfully"
      : undefined,
  };
}
