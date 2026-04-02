import { createSupabaseAdminClient } from "@lib/supabase/admin";

type TraceSessionRow = Record<string, unknown>;
type WorkflowRunRow = Record<string, unknown>;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

function pickWorkflowName(row: Record<string, unknown> | null | undefined): string {
  const title = typeof row?.title === "string" && row.title.trim() ? row.title.trim() : null;
  const name = typeof row?.name === "string" && row.name.trim() ? row.name.trim() : null;
  return title ?? name ?? "Untitled Workflow";
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

  const workflowIds = Array.from(
    new Set(
      (workflowRuns ?? [])
        .map((row: WorkflowRunRow) =>
          typeof row.workflow_id === "string" && row.workflow_id.trim() ? row.workflow_id : null,
        )
        .filter(Boolean),
    ),
  );
  const draftIds = Array.from(
    new Set(
      (workflowRuns ?? [])
        .map((row: WorkflowRunRow) =>
          typeof row.draft_id === "string" && row.draft_id.trim() ? row.draft_id : null,
        )
        .filter(Boolean),
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
    const { data, error } = await supabase
      .from("workflows")
      .select("id, title, name, owner_id, owner_handle, owner_name")
      .in("id", workflowIds);
    if (error) throw error;
    for (const row of data ?? []) workflowMap.set(String(row.id), row as Record<string, unknown>);
  }

  const draftMap = new Map<string, Record<string, unknown>>();
  if (draftIds.length > 0) {
    const { data, error } = await supabase
      .from("workflow_drafts")
      .select("id, title, name, owner_id")
      .in("id", draftIds);
    if (error) throw error;
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

  const { data: traceSessions, error: sessionsError } = await supabase
    .from("trace_sessions")
    .select("*")
    .eq("workflow_run_id", workflowRunId)
    .order("started_at_epoch_ms", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessionIds = (traceSessions ?? []).map((session: Record<string, unknown>) =>
    String(session.id),
  );
  const { data: traceEntries, error: entriesError } = sessionIds.length
    ? await supabase
        .from("trace_entries")
        .select("*")
        .in("trace_session_id", sessionIds)
        .order("timestamp_epoch_ms", { ascending: true })
    : { data: [], error: null };
  if (entriesError) throw entriesError;

  const { data: workflowEvents, error: workflowEventsError } = await supabase
    .from("workflow_run_events")
    .select("sequence, event_type, node_id, attempt_number, payload, created_at")
    .eq("workflow_run_id", workflowRunId)
    .order("sequence", { ascending: true });
  if (workflowEventsError) throw workflowEventsError;

  const bundleStartedAtEpochMs =
    Math.min(
      ...[
        ...(traceSessions ?? []).map((session: Record<string, unknown>) =>
          Number(session.started_at_epoch_ms ?? Number.MAX_SAFE_INTEGER),
        ),
        Date.parse(String(bundleMeta.startedAt ?? "")) || Number.MAX_SAFE_INTEGER,
      ],
    ) || Date.now();

  const sessionById = new Map<string, Record<string, unknown>>(
    (traceSessions ?? []).map((session: Record<string, unknown>) => [String(session.id), session]),
  );
  const workflowTimeline = (workflowEvents ?? []).map((event: Record<string, unknown>) => ({
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

  const traceTimeline = (traceEntries ?? []).map((entry: Record<string, unknown>) => ({
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

  return {
    bundle: {
      id: workflowRunId,
      workflowRunId,
      workflowId: bundleMeta.workflowId ?? null,
      draftId: bundleMeta.draftId ?? null,
      workflowName: bundleMeta.workflowName,
      accountLabel: bundleMeta.accountLabel,
      accountHandle: bundleMeta.accountHandle ?? null,
      accountName: bundleMeta.accountName ?? null,
      status: bundleMeta.status,
      startedAt: bundleMeta.startedAt,
      durationMs: bundleMeta.durationMs,
      traceSessionCount: (traceSessions ?? []).length,
      traceEntryCount: (traceEntries ?? []).length,
      workflowEventCount: (workflowEvents ?? []).length,
      metadata: bundleMeta.metadata ?? {},
    },
    traceSessions: traceSessions ?? [],
    traceEntries: traceEntries ?? [],
    workflowEvents: workflowEvents ?? [],
    timeline: orderedTimeline,
  };
}
