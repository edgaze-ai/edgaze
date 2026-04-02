import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { isAdmin } from "@lib/supabase/executions";

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
      .order("started_at_epoch_ms", { ascending: false })
      .range(offset, offset + limit - 1);

    if (phase) sessionsQuery = sessionsQuery.eq("phase", phase);
    if (source) sessionsQuery = sessionsQuery.eq("source", source);
    if (workflowRunId) sessionsQuery = sessionsQuery.eq("workflow_run_id", workflowRunId);
    if (analyticsRunId) sessionsQuery = sessionsQuery.eq("analytics_run_id", analyticsRunId);
    if (routeId) sessionsQuery = sessionsQuery.eq("route_id", routeId);

    const { data: sessions, error, count } = await sessionsQuery;
    if (error) throw error;

    const filteredSessions = (sessions ?? []).filter((session: Record<string, unknown>) => {
      if (!query) return true;
      const haystack = [
        session.id,
        session.route_id,
        session.request_path,
        session.workflow_id,
        session.workflow_run_id,
        session.analytics_run_id,
        session.correlation_id,
        session.actor_id,
        session.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });

    const aggregates = {
      totalSessions: count ?? filteredSessions.length,
      byPhase: filteredSessions.reduce(
        (acc: Record<string, number>, session: Record<string, unknown>) => {
          const key = String(session.phase ?? "unknown");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
      bySource: filteredSessions.reduce(
        (acc: Record<string, number>, session: Record<string, unknown>) => {
          const key = String(session.source ?? "unknown");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
    };

    return NextResponse.json({
      sessions: filteredSessions,
      total: count ?? filteredSessions.length,
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
