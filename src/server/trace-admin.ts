import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { redactSecrets } from "src/server/flow/runtime-enforcement";
import { loadWorkflowRunBootstrap } from "src/server/flow-v2/read-model";

type TraceSessionRow = Record<string, unknown>;
type WorkflowRunRow = Record<string, unknown>;
type NodeTimelineEventSummary = {
  timestampEpochMs: number;
  sinceBundleStartMs: number | null;
  phase: string;
  source: string;
  eventName: string;
  sequence: number;
  attemptNumber: number | null;
  payload: Record<string, unknown>;
  nodeId: string;
  status: string | null;
  title: string | null;
};

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

function pickWorkflowName(row: Record<string, unknown> | null | undefined): string {
  const title = typeof row?.title === "string" && row.title.trim() ? row.title.trim() : null;
  const name = typeof row?.name === "string" && row.name.trim() ? row.name.trim() : null;
  return title ?? name ?? "Untitled Workflow";
}

function isMissingColumnError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return message.includes("column") && message.includes("does not exist");
}

async function selectManyWithFallback(
  table: string,
  ids: string[],
  selects: string[],
): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient() as any;
  let lastError: unknown = null;
  for (const select of selects) {
    const result = await supabase.from(table).select(select).in("id", ids);
    if (!result.error) {
      return (result.data ?? []) as Record<string, unknown>[];
    }
    lastError = result.error;
    if (!isMissingColumnError(result.error)) {
      throw result.error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

const PAGE_SIZE = 1000;

async function fetchAllRows(params: {
  table: string;
  select: string;
  filters?: Array<{ column: string; operator?: "eq" | "in"; value: unknown }>;
  orderBy?: { column: string; ascending?: boolean };
}): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient() as any;
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(params.table).select(params.select);
    for (const filter of params.filters ?? []) {
      if (filter.operator === "in") {
        query = query.in(filter.column, filter.value);
      } else {
        query = query.eq(filter.column, filter.value);
      }
    }
    if (params.orderBy) {
      query = query.order(params.orderBy.column, { ascending: params.orderBy.ascending ?? true });
    }
    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function buildAccountLabel(
  userId: string | null | undefined,
  profile?: Record<string, unknown> | null,
) {
  if (!userId) return "unknown";
  if (
    userId === "anonymous_demo_user" ||
    userId === "admin_demo_user" ||
    userId.startsWith("pending_authenticated_stream:")
  ) {
    return "demo";
  }
  if (profile) {
    const handle =
      typeof profile.handle === "string" && profile.handle.trim()
        ? `@${profile.handle.trim()}`
        : null;
    const fullName =
      typeof profile.full_name === "string" && profile.full_name.trim()
        ? profile.full_name.trim()
        : null;
    return handle ?? fullName ?? userId;
  }
  return userId;
}

function normalizeEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function summarizeTimelineItem(
  item: Record<string, unknown>,
): Omit<NodeTimelineEventSummary, "nodeId" | "status" | "title"> {
  return {
    timestampEpochMs: normalizeEpochMs(item.timestampEpochMs) ?? 0,
    sinceBundleStartMs:
      typeof item.sinceBundleStartMs === "number" ? Number(item.sinceBundleStartMs) : null,
    phase: typeof item.phase === "string" ? item.phase : "unknown",
    source: typeof item.source === "string" ? item.source : "unknown",
    eventName: typeof item.eventName === "string" ? item.eventName : "unknown",
    sequence: typeof item.sequence === "number" ? Number(item.sequence) : 0,
    attemptNumber: typeof item.attemptNumber === "number" ? Number(item.attemptNumber) : null,
    payload:
      item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? (item.payload as Record<string, unknown>)
        : {},
  };
}

function buildNodeExecutionDetails(params: {
  nodes: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
}) {
  const nodeMap = new Map<string, Record<string, unknown>>();
  for (const node of params.nodes) {
    const workflowNodeId =
      typeof node.nodeId === "string" && node.nodeId.trim()
        ? node.nodeId
        : typeof node.id === "string" && node.id.trim()
          ? node.id
          : null;
    if (workflowNodeId) {
      nodeMap.set(workflowNodeId, node);
    }
  }

  const attemptMap = new Map<string, Array<Record<string, unknown>>>();
  for (const attempt of params.attempts) {
    const nodeId = typeof attempt.nodeId === "string" ? attempt.nodeId : null;
    if (!nodeId) continue;
    if (!attemptMap.has(nodeId)) attemptMap.set(nodeId, []);
    attemptMap.get(nodeId)!.push(attempt);
  }

  const uiEventMap = new Map<string, Array<NodeTimelineEventSummary>>();
  const typedServerEventMap = new Map<string, Array<NodeTimelineEventSummary>>();
  for (const item of params.timeline) {
    const nodeId = typeof item.nodeId === "string" ? item.nodeId : null;
    if (!nodeId) continue;
    const source = typeof item.source === "string" ? item.source : "unknown";
    const phase = typeof item.phase === "string" ? item.phase : "unknown";
    const eventName = typeof item.eventName === "string" ? item.eventName : "unknown";
    const payload =
      item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? (item.payload as Record<string, unknown>)
        : {};
    const targetMap =
      source === "client" || phase === "client_render" || eventName.startsWith("ui.")
        ? uiEventMap
        : typedServerEventMap;
    if (!targetMap.has(nodeId)) targetMap.set(nodeId, []);
    targetMap.get(nodeId)!.push({
      ...summarizeTimelineItem(item),
      nodeId,
      status: typeof payload.status === "string" ? payload.status : null,
      title: typeof payload.title === "string" ? payload.title : null,
    });
  }

  const nodeIds = Array.from(
    new Set([
      ...nodeMap.keys(),
      ...attemptMap.keys(),
      ...typedServerEventMap.keys(),
      ...uiEventMap.keys(),
    ]),
  );

  return nodeIds
    .map((nodeId) => {
      const node = nodeMap.get(nodeId) ?? {};
      const attempts = (attemptMap.get(nodeId) ?? []).slice().sort((a, b) => {
        return Number(a.attemptNumber ?? 0) - Number(b.attemptNumber ?? 0);
      });
      const serverEvents = (typedServerEventMap.get(nodeId) ?? []).slice().sort((a, b) => {
        return Number(a.timestampEpochMs ?? 0) - Number(b.timestampEpochMs ?? 0);
      });
      const uiEvents = (uiEventMap.get(nodeId) ?? []).slice().sort((a, b) => {
        return Number(a.timestampEpochMs ?? 0) - Number(b.timestampEpochMs ?? 0);
      });

      const serverStartCandidates = [
        ...attempts
          .map((attempt) => normalizeEpochMs(attempt.startedAt))
          .filter((value): value is number => value !== null),
        ...serverEvents
          .filter(
            (event) =>
              event.eventName === "node.started" || event.eventName === "node_attempt_started",
          )
          .map((event) => normalizeEpochMs(event.timestampEpochMs))
          .filter((value): value is number => value !== null),
      ];
      const serverEndCandidates = [
        ...attempts
          .map((attempt) => normalizeEpochMs(attempt.endedAt))
          .filter((value): value is number => value !== null),
        ...serverEvents
          .filter((event) =>
            [
              "node.completed",
              "node.failed",
              "node.cancelled",
              "node.skipped",
              "node.blocked",
            ].includes(String(event.eventName)),
          )
          .map((event) => normalizeEpochMs(event.timestampEpochMs))
          .filter((value): value is number => value !== null),
      ];
      const uiVisibleEvents = uiEvents.filter(
        (event) => event.eventName === "ui.node_state_visible",
      );
      const uiFirstVisibleAtEpochMs = uiVisibleEvents[0]?.timestampEpochMs ?? null;
      const uiRunningVisibleAtEpochMs =
        uiVisibleEvents.find((event) => event.status === "running")?.timestampEpochMs ?? null;
      const uiTerminalVisibleAtEpochMs =
        uiVisibleEvents.find((event) =>
          ["done", "error", "skipped", "cancelled"].includes(String(event.status)),
        )?.timestampEpochMs ?? null;
      const serverStartedAtEpochMs =
        serverStartCandidates.length > 0 ? Math.min(...serverStartCandidates) : null;
      const serverEndedAtEpochMs =
        serverEndCandidates.length > 0 ? Math.max(...serverEndCandidates) : null;
      const fallbackStartedAtEpochMs = normalizeEpochMs(node.startedAt);
      const fallbackEndedAtEpochMs = normalizeEpochMs(node.endedAt);
      const effectiveServerStartedAtEpochMs = serverStartedAtEpochMs ?? fallbackStartedAtEpochMs;
      const effectiveServerEndedAtEpochMs = serverEndedAtEpochMs ?? fallbackEndedAtEpochMs;

      return {
        nodeId,
        runNodeRecordId: typeof node.id === "string" ? node.id : null,
        title:
          typeof node.title === "string" && node.title.trim()
            ? node.title
            : typeof node.nodeId === "string" && node.nodeId.trim()
              ? node.nodeId
              : typeof node.name === "string" && node.name.trim()
                ? node.name
                : nodeId,
        specId: typeof node.specId === "string" ? node.specId : null,
        status: typeof node.status === "string" ? node.status : null,
        serverStartedAtEpochMs: effectiveServerStartedAtEpochMs,
        serverStartedAt: effectiveServerStartedAtEpochMs
          ? new Date(effectiveServerStartedAtEpochMs).toISOString()
          : null,
        serverEndedAtEpochMs: effectiveServerEndedAtEpochMs,
        serverEndedAt: effectiveServerEndedAtEpochMs
          ? new Date(effectiveServerEndedAtEpochMs).toISOString()
          : null,
        serverDurationMs:
          effectiveServerStartedAtEpochMs !== null && effectiveServerEndedAtEpochMs !== null
            ? Math.max(0, effectiveServerEndedAtEpochMs - effectiveServerStartedAtEpochMs)
            : null,
        uiFirstVisibleAtEpochMs,
        uiFirstVisibleAt: uiFirstVisibleAtEpochMs
          ? new Date(uiFirstVisibleAtEpochMs).toISOString()
          : null,
        uiRunningVisibleAtEpochMs,
        uiRunningVisibleAt: uiRunningVisibleAtEpochMs
          ? new Date(uiRunningVisibleAtEpochMs).toISOString()
          : null,
        uiTerminalVisibleAtEpochMs,
        uiTerminalVisibleAt: uiTerminalVisibleAtEpochMs
          ? new Date(uiTerminalVisibleAtEpochMs).toISOString()
          : null,
        uiLagFromServerStartMs:
          effectiveServerStartedAtEpochMs !== null && uiFirstVisibleAtEpochMs !== null
            ? uiFirstVisibleAtEpochMs - effectiveServerStartedAtEpochMs
            : null,
        uiLagFromServerFinishMs:
          effectiveServerEndedAtEpochMs !== null && uiTerminalVisibleAtEpochMs !== null
            ? uiTerminalVisibleAtEpochMs - effectiveServerEndedAtEpochMs
            : null,
        attempts: attempts.map((attempt) => ({
          attemptNumber:
            typeof attempt.attemptNumber === "number" ? Number(attempt.attemptNumber) : null,
          status: typeof attempt.status === "string" ? attempt.status : null,
          startedAt: attempt.startedAt ?? null,
          endedAt: attempt.endedAt ?? null,
          durationMs: typeof attempt.durationMs === "number" ? Number(attempt.durationMs) : null,
          error: attempt.error ?? null,
        })),
        serverEvents,
        uiEvents,
      };
    })
    .sort((a, b) => {
      const aEpoch = a.serverStartedAtEpochMs ?? Number.MAX_SAFE_INTEGER;
      const bEpoch = b.serverStartedAtEpochMs ?? Number.MAX_SAFE_INTEGER;
      if (aEpoch !== bEpoch) return aEpoch - bEpoch;
      return a.nodeId.localeCompare(b.nodeId);
    });
}

export async function resolveWorkflowRunBundleMetadata(workflowRunIds: string[]) {
  if (workflowRunIds.length === 0) return new Map<string, Record<string, unknown>>();

  const supabase = createSupabaseAdminClient() as any;
  const { data: workflowRuns, error: workflowRunsError } = await supabase
    .from("workflow_runs")
    .select(
      "id, workflow_id, draft_id, workflow_version_id, user_id, status, started_at, duration_ms, metadata",
    )
    .in("id", workflowRunIds);
  if (workflowRunsError) throw workflowRunsError;

  const workflowIds: string[] = Array.from(
    new Set(
      (workflowRuns ?? [])
        .map((row: WorkflowRunRow) =>
          typeof row.workflow_id === "string" && row.workflow_id.trim() ? row.workflow_id : null,
        )
        .filter((value: string | null): value is string => Boolean(value)),
    ),
  );
  const draftIds: string[] = Array.from(
    new Set(
      (workflowRuns ?? [])
        .map((row: WorkflowRunRow) =>
          typeof row.draft_id === "string" && row.draft_id.trim() ? row.draft_id : null,
        )
        .filter((value: string | null): value is string => Boolean(value)),
    ),
  );
  const runnerIds = Array.from(
    new Set(
      (workflowRuns ?? [])
        .map((row: WorkflowRunRow) =>
          typeof row.user_id === "string" && row.user_id.trim() ? row.user_id : null,
        )
        .filter(Boolean),
    ),
  );

  const workflowMap = new Map<string, Record<string, unknown>>();
  if (workflowIds.length > 0) {
    const data = await selectManyWithFallback("workflows", workflowIds, [
      "id, title, owner_id, owner_handle, owner_name",
      "id, title, owner_id, owner_handle",
      "id, title, owner_id",
      "id, owner_id, owner_handle, owner_name",
      "id, owner_id, owner_handle",
      "id, owner_id",
    ]);
    for (const row of data ?? []) workflowMap.set(String(row.id), row as Record<string, unknown>);
  }

  const draftMap = new Map<string, Record<string, unknown>>();
  if (draftIds.length > 0) {
    const data = await selectManyWithFallback("workflow_drafts", draftIds, [
      "id, title, owner_id",
      "id, name, owner_id",
      "id, owner_id",
    ]);
    for (const row of data ?? []) draftMap.set(String(row.id), row as Record<string, unknown>);
  }

  const profileIds = runnerIds.filter((id): id is string => isUuid(String(id)));
  const profileMap = new Map<string, Record<string, unknown>>();
  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, full_name")
      .in("id", profileIds);
    if (error) throw error;
    for (const row of data ?? []) profileMap.set(String(row.id), row as Record<string, unknown>);
  }

  const metadataByRunId = new Map<string, Record<string, unknown>>();
  for (const run of workflowRuns ?? []) {
    const workflowId = typeof run.workflow_id === "string" ? run.workflow_id : null;
    const draftId = typeof run.draft_id === "string" ? run.draft_id : null;
    const runnerUserId = typeof run.user_id === "string" ? run.user_id : null;
    const workflow = workflowId ? workflowMap.get(workflowId) : null;
    const draft = draftId ? draftMap.get(draftId) : null;
    const profile = runnerUserId ? profileMap.get(runnerUserId) : null;
    metadataByRunId.set(String(run.id), {
      workflowRunId: String(run.id),
      workflowId,
      draftId,
      workflowName: workflow
        ? pickWorkflowName(workflow)
        : draft
          ? pickWorkflowName(draft)
          : "Untitled Workflow",
      workflowOwnerHandle:
        typeof workflow?.owner_handle === "string" ? workflow.owner_handle : null,
      workflowOwnerName: typeof workflow?.owner_name === "string" ? workflow.owner_name : null,
      runnerUserId,
      accountLabel: buildAccountLabel(runnerUserId, profile ?? null),
      accountHandle: typeof profile?.handle === "string" ? profile.handle : null,
      accountName: typeof profile?.full_name === "string" ? profile.full_name : null,
      status: typeof run.status === "string" ? run.status : "unknown",
      startedAt: typeof run.started_at === "string" ? run.started_at : null,
      durationMs: typeof run.duration_ms === "number" ? run.duration_ms : null,
      metadata: run.metadata ?? {},
    });
  }

  return metadataByRunId;
}

export async function buildWorkflowRunTraceBundle(workflowRunId: string) {
  const supabase = createSupabaseAdminClient() as any;
  const metadataByRunId = await resolveWorkflowRunBundleMetadata([workflowRunId]);
  const bundleMeta = metadataByRunId.get(workflowRunId);
  if (!bundleMeta) {
    throw new Error("Trace bundle not found");
  }

  const bootstrap = await loadWorkflowRunBootstrap({
    runId: workflowRunId,
    afterSequence: 0,
    eventLimit: 2000,
  });

  const traceSessions = await fetchAllRows({
    table: "trace_sessions",
    select: "*",
    filters: [{ column: "workflow_run_id", value: workflowRunId }],
    orderBy: { column: "started_at_epoch_ms", ascending: true },
  });

  const sessionIds = traceSessions.map((session: Record<string, unknown>) => String(session.id));
  const traceEntries = sessionIds.length
    ? await fetchAllRows({
        table: "trace_entries",
        select: "*",
        filters: [{ column: "trace_session_id", operator: "in", value: sessionIds }],
        orderBy: { column: "timestamp_epoch_ms", ascending: true },
      })
    : [];

  const workflowEvents = await fetchAllRows({
    table: "workflow_run_events",
    select: "sequence, event_type, node_id, attempt_number, payload, created_at",
    filters: [{ column: "workflow_run_id", value: workflowRunId }],
    orderBy: { column: "sequence", ascending: true },
  });

  const bundleStartedAtEpochMs =
    Math.min(
      ...[
        ...traceSessions.map((session: Record<string, unknown>) =>
          Number(session.started_at_epoch_ms ?? Number.MAX_SAFE_INTEGER),
        ),
        Date.parse(String(bundleMeta.startedAt ?? "")) || Number.MAX_SAFE_INTEGER,
      ],
    ) || Date.now();

  const sessionById = new Map<string, Record<string, unknown>>(
    traceSessions.map((session: Record<string, unknown>) => [String(session.id), session]),
  );
  const workflowTimeline = workflowEvents.map((event: Record<string, unknown>) => ({
    timelineSource: "workflow_event",
    timestampEpochMs: Date.parse(String(event.created_at ?? "")) || 0,
    sinceBundleStartMs: Math.max(
      0,
      (Date.parse(String(event.created_at ?? "")) || 0) - bundleStartedAtEpochMs,
    ),
    phase: String(event.event_type ?? "").startsWith("node.stream.") ? "stream" : "worker",
    source: "workflow",
    sessionId: workflowRunId,
    sessionKind: "workflow_run",
    sequence: Number(event.sequence ?? 0),
    severity: String(event.event_type ?? "").includes("failed")
      ? "error"
      : String(event.event_type ?? "").includes("blocked") ||
          String(event.event_type ?? "").includes("skipped")
        ? "warn"
        : "info",
    eventName: String(event.event_type ?? "workflow.unknown"),
    nodeId: typeof event.node_id === "string" ? event.node_id : null,
    attemptNumber: typeof event.attempt_number === "number" ? Number(event.attempt_number) : null,
    payload: event.payload ?? {},
  }));

  const traceTimeline = traceEntries.map((entry: Record<string, unknown>) => ({
    timelineSource: "trace_entry",
    timestampEpochMs: Number(entry.timestamp_epoch_ms ?? 0),
    sinceBundleStartMs: Math.max(0, Number(entry.timestamp_epoch_ms ?? 0) - bundleStartedAtEpochMs),
    phase: String(entry.phase ?? "unknown"),
    source: String(entry.source ?? "unknown"),
    sessionId: String(entry.trace_session_id),
    sessionKind: String(sessionById.get(String(entry.trace_session_id))?.kind ?? "unknown"),
    sequence: Number(entry.sequence ?? 0),
    severity: String(entry.severity ?? "info"),
    eventName: String(entry.event_name ?? "unknown"),
    nodeId: typeof entry.node_id === "string" ? entry.node_id : null,
    attemptNumber: typeof entry.attempt_number === "number" ? Number(entry.attempt_number) : null,
    payload: entry.payload ?? {},
  }));

  const orderedTimeline = [...traceTimeline, ...workflowTimeline].sort((a, b) => {
    if (a.timestampEpochMs !== b.timestampEpochMs) return a.timestampEpochMs - b.timestampEpochMs;
    const phaseCompare = a.phase.localeCompare(b.phase);
    if (phaseCompare !== 0) return phaseCompare;
    return a.sequence - b.sequence;
  });

  const streamEvents = orderedTimeline.filter(
    (item) =>
      item.phase === "stream" ||
      item.eventName.startsWith("node.stream.") ||
      item.eventName.includes("stream."),
  );
  const streamSummary = {
    eventCount: streamEvents.length,
    firstStreamEventAt: streamEvents[0]?.timestampEpochMs ?? null,
    lastStreamEventAt: streamEvents[streamEvents.length - 1]?.timestampEpochMs ?? null,
    deltaEventCount: streamEvents.filter((item) => item.eventName === "node.stream.delta").length,
    startedEventCount: streamEvents.filter((item) => item.eventName === "node.stream.started")
      .length,
    finishedEventCount: streamEvents.filter((item) => item.eventName === "node.stream.finished")
      .length,
  };
  const expectedTraceEntryCount = (traceSessions ?? []).reduce(
    (sum: number, session: Record<string, unknown>) => sum + Number(session.event_count ?? 0),
    0,
  );
  const traceDiagnostics = {
    expectedTraceEntryCount,
    actualTraceEntryCount: traceEntries.length,
    missingTraceEntryCount: Math.max(0, expectedTraceEntryCount - traceEntries.length),
    actualWorkflowEventCount: workflowEvents.length,
    workflowLastEventSequence:
      typeof bootstrap.run?.lastEventSequence === "number" ? bootstrap.run.lastEventSequence : null,
  };
  const nodeExecutionDetails = buildNodeExecutionDetails({
    nodes: (bootstrap.nodes ?? []) as unknown as Array<Record<string, unknown>>,
    attempts: (bootstrap.attempts ?? []) as unknown as Array<Record<string, unknown>>,
    timeline: orderedTimeline as Array<Record<string, unknown>>,
  });
  const fallbackWorkflowId =
    (typeof bundleMeta.workflowId === "string" && bundleMeta.workflowId.trim()
      ? bundleMeta.workflowId
      : null) ??
    (typeof bootstrap.run?.workflowId === "string" && bootstrap.run.workflowId.trim()
      ? bootstrap.run.workflowId
      : null) ??
    (() => {
      for (const session of traceSessions) {
        if (typeof session.workflow_id === "string" && session.workflow_id.trim()) {
          return session.workflow_id;
        }
      }
      return null;
    })() ??
    (typeof bundleMeta.draftId === "string" && bundleMeta.draftId.trim() ? bundleMeta.draftId : null);
  const fallbackDurationMs =
    (typeof bundleMeta.durationMs === "number" && Number.isFinite(bundleMeta.durationMs)
      ? bundleMeta.durationMs
      : null) ??
    (() => {
      const sessionDurations = traceSessions
        .map((session) =>
          typeof session.duration_ms === "number" && Number.isFinite(session.duration_ms)
            ? Number(session.duration_ms)
            : null,
        )
        .filter((value): value is number => value !== null);
      return sessionDurations.length > 0 ? Math.max(...sessionDurations) : null;
    })();

  return redactSecrets(
    {
    bundle: {
      id: workflowRunId,
      workflowRunId,
      workflowId: fallbackWorkflowId,
      draftId: bundleMeta.draftId ?? null,
      workflowName: bundleMeta.workflowName,
      accountLabel: bundleMeta.accountLabel,
      accountHandle: bundleMeta.accountHandle ?? null,
      accountName: bundleMeta.accountName ?? null,
      status: bundleMeta.status,
      startedAt: bundleMeta.startedAt,
      durationMs: fallbackDurationMs,
      traceSessionCount: traceSessions.length,
      traceEntryCount: traceEntries.length,
      workflowEventCount: workflowEvents.length,
      traceDiagnostics,
      metadata: bundleMeta.metadata ?? {},
    },
    run: {
      ...bootstrap.run,
      workflowId: fallbackWorkflowId,
    },
    nodes: bootstrap.nodes,
    attempts: bootstrap.attempts,
    nodeExecutionDetails,
    dependencyStateByNodeId: bootstrap.dependencyStateByNodeId,
    streamSummary,
    streamEvents,
    traceSessions,
    traceEntries,
    workflowEvents,
    timeline: orderedTimeline,
    },
    { preserveExecutionSecrets: false },
  ) as {
    bundle: Record<string, unknown>;
    run: Record<string, unknown>;
    nodes: unknown[];
    attempts: unknown[];
    nodeExecutionDetails: unknown[];
    dependencyStateByNodeId: Record<string, unknown>;
    streamSummary: Record<string, unknown>;
    streamEvents: unknown[];
    traceSessions: unknown[];
    traceEntries: unknown[];
    workflowEvents: unknown[];
    timeline: unknown[];
  };
}
