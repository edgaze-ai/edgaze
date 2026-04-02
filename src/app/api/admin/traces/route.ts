import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { resolveWorkflowRunBundleMetadata } from "src/server/trace-admin";

function getSinceIso(range: string) {
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const range = searchParams.get("range") || "7d";
    const phase = searchParams.get("phase") || "";
    const source = searchParams.get("source") || "";
    const workflowRunId = searchParams.get("workflowRunId") || "";
    const analyticsRunId = searchParams.get("analyticsRunId") || "";
    const routeId = searchParams.get("routeId") || "";
    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    const supabase = createSupabaseAdminClient() as any;
    let sessionsQuery = supabase
      .from("trace_sessions")
      .select("*", { count: "exact" })
      .gte("created_at", getSinceIso(range))
      .not("workflow_run_id", "is", null)
      .order("started_at_epoch_ms", { ascending: false })
      .range(offset, offset + limit - 1);

    if (phase) sessionsQuery = sessionsQuery.eq("phase", phase);
    if (source) sessionsQuery = sessionsQuery.eq("source", source);
    if (workflowRunId) sessionsQuery = sessionsQuery.eq("workflow_run_id", workflowRunId);
    if (analyticsRunId) sessionsQuery = sessionsQuery.eq("analytics_run_id", analyticsRunId);
    if (routeId) sessionsQuery = sessionsQuery.eq("route_id", routeId);

    const { data: sessions, error, count } = await sessionsQuery;
    if (error) throw error;

    const groupedByWorkflowRunId = new Map<string, Record<string, unknown>[]>();
    for (const session of sessions ?? []) {
      const workflowRunId =
        typeof session.workflow_run_id === "string" && session.workflow_run_id.trim()
          ? session.workflow_run_id
          : null;
      if (!workflowRunId) continue;
      if (!groupedByWorkflowRunId.has(workflowRunId)) groupedByWorkflowRunId.set(workflowRunId, []);
      groupedByWorkflowRunId.get(workflowRunId)!.push(session as Record<string, unknown>);
    }

    const bundleMetadata = await resolveWorkflowRunBundleMetadata([
      ...groupedByWorkflowRunId.keys(),
    ]);
    const bundles = [...groupedByWorkflowRunId.entries()].map(([workflowRunId, runSessions]) => {
      const meta = bundleMetadata.get(workflowRunId);
      const firstStartedAt = Math.min(
        ...runSessions.map((session) => Number(session.started_at_epoch_ms ?? Date.now())),
      );
      const lastDurationMs = Math.max(
        0,
        ...runSessions.map((session) => Number(session.duration_ms ?? 0)),
      );
      const eventCount = runSessions.reduce(
        (sum, session) => sum + Number(session.event_count ?? 0),
        0,
      );
      return {
        id: workflowRunId,
        workflow_run_id: workflowRunId,
        workflow_name: meta?.workflowName ?? "Untitled Workflow",
        account_label: meta?.accountLabel ?? "unknown",
        account_handle: meta?.accountHandle ?? null,
        account_name: meta?.accountName ?? null,
        source: "workflow_run_bundle",
        phase: "bundle",
        route_id: runSessions[0]?.route_id ?? null,
        request_path: runSessions[0]?.request_path ?? null,
        workflow_id: meta?.workflowId ?? null,
        analytics_run_id: runSessions[0]?.analytics_run_id ?? null,
        status: meta?.status ?? String(runSessions[runSessions.length - 1]?.status ?? "unknown"),
        actor_id: meta?.runnerUserId ?? null,
        started_at_epoch_ms: Number.isFinite(firstStartedAt) ? firstStartedAt : Date.now(),
        duration_ms: meta?.durationMs ?? lastDurationMs,
        event_count: eventCount,
        session_count: runSessions.length,
      };
    });

    const filteredBundles = bundles.filter((bundle) => {
      if (!query) return true;
      const haystack = [
        bundle.id,
        bundle.workflow_name,
        bundle.account_label,
        bundle.account_handle,
        bundle.account_name,
        bundle.route_id,
        bundle.request_path,
        bundle.workflow_id,
        bundle.analytics_run_id,
        bundle.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });

    const aggregates = {
      totalSessions: count ?? filteredBundles.length,
      byPhase: filteredBundles.reduce(
        (acc: Record<string, number>, session: Record<string, unknown>) => {
          const key = String(session.phase ?? "unknown");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
      bySource: filteredBundles.reduce(
        (acc: Record<string, number>, session: Record<string, unknown>) => {
          const key = String(session.source ?? "unknown");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
    };

    return NextResponse.json({
      sessions: filteredBundles,
      total: filteredBundles.length,
      page,
      limit,
      aggregates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load trace sessions.",
      },
      { status: 500 },
    );
  }
}
