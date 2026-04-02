import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { isAdmin } from "@lib/supabase/executions";

function phaseForWorkflowEvent(eventType: string): string {
  if (eventType.startsWith("node.stream.")) return "stream";
  if (eventType.startsWith("run.")) return "worker";
  return "worker";
}

function severityForWorkflowEvent(eventType: string): string {
  if (eventType.includes("failed") || eventType.includes("cancelled")) return "error";
  if (eventType.includes("blocked") || eventType.includes("skipped")) return "warn";
  return "info";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { sessionId } = await params;
    const supabase = createSupabaseAdminClient() as any;
    const { data: session, error: sessionError } = await supabase
      .from("trace_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Trace session not found" }, { status: 404 });
    }

    let relatedSessionsQuery = supabase.from("trace_sessions").select("*");
    if (session.workflow_run_id) {
      relatedSessionsQuery = relatedSessionsQuery.eq("workflow_run_id", session.workflow_run_id);
    } else if (session.correlation_id) {
      relatedSessionsQuery = relatedSessionsQuery.eq("correlation_id", session.correlation_id);
    } else {
      relatedSessionsQuery = relatedSessionsQuery.eq("id", sessionId);
    }
    const { data: relatedSessions, error: relatedError } = await relatedSessionsQuery.order(
      "started_at_epoch_ms",
      { ascending: true },
    );
    if (relatedError) throw relatedError;

    const sessionIds = (relatedSessions ?? []).map((item: { id: string }) => item.id);
    const { data: traceEntries, error: entriesError } = sessionIds.length
      ? await supabase
          .from("trace_entries")
          .select("*")
          .in("trace_session_id", sessionIds)
          .order("timestamp_epoch_ms", { ascending: true })
      : { data: [], error: null };
    if (entriesError) throw entriesError;

    const workflowEvents = session.workflow_run_id
      ? ((
          await supabase
            .from("workflow_run_events")
            .select("sequence, event_type, node_id, attempt_number, payload, created_at")
            .eq("workflow_run_id", session.workflow_run_id)
            .order("sequence", { ascending: true })
        ).data ?? [])
      : [];

    const sessionById = new Map<string, Record<string, unknown>>(
      (relatedSessions ?? []).map((item: Record<string, unknown>) => [String(item.id), item]),
    );
    const timeline = [
      ...(traceEntries ?? []).map((entry: Record<string, unknown>) => ({
        timelineSource: "trace_entry",
        timestampEpochMs: Number(entry.timestamp_epoch_ms ?? 0),
        phase: String(entry.phase ?? "unknown"),
        source: String(entry.source ?? "unknown"),
        sessionId: String(entry.trace_session_id),
        sessionKind: String(sessionById.get(String(entry.trace_session_id))?.kind ?? "unknown"),
        sequence: Number(entry.sequence ?? 0),
        severity: String(entry.severity ?? "info"),
        eventName: String(entry.event_name ?? "unknown"),
        nodeId: entry.node_id ? String(entry.node_id) : null,
        attemptNumber:
          typeof entry.attempt_number === "number" ? Number(entry.attempt_number) : null,
        payload: entry.payload ?? {},
      })),
      ...workflowEvents.map((event: Record<string, unknown>) => ({
        timelineSource: "workflow_event",
        timestampEpochMs: Date.parse(String(event.created_at ?? "")) || 0,
        phase: phaseForWorkflowEvent(String(event.event_type ?? "")),
        source: "workflow",
        sessionId: session.workflow_run_id as string,
        sessionKind: "workflow",
        sequence: Number(event.sequence ?? 0),
        severity: severityForWorkflowEvent(String(event.event_type ?? "")),
        eventName: String(event.event_type ?? "workflow.unknown"),
        nodeId: event.node_id ? String(event.node_id) : null,
        attemptNumber:
          typeof event.attempt_number === "number" ? Number(event.attempt_number) : null,
        payload: event.payload ?? {},
      })),
    ].sort((a, b) => {
      if (a.timestampEpochMs !== b.timestampEpochMs) return a.timestampEpochMs - b.timestampEpochMs;
      if (a.phase !== b.phase) return a.phase.localeCompare(b.phase);
      return a.sequence - b.sequence;
    });

    const sessionStartEpoch =
      timeline[0]?.timestampEpochMs ?? Number(session.started_at_epoch_ms ?? Date.now());
    const timelineWithRelativeTime = timeline.map((item) => ({
      ...item,
      sinceSessionStartMs: Math.max(0, item.timestampEpochMs - sessionStartEpoch),
    }));

    return NextResponse.json({
      session,
      relatedSessions: relatedSessions ?? [],
      timeline: timelineWithRelativeTime,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trace detail." },
      { status: 500 },
    );
  }
}
