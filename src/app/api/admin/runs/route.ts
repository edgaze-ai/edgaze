// src/app/api/admin/runs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError ?? "Not authenticated" },
        { status: 401 }
      );
    }
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d"; // 7d | 30d | 90d
    const kind = searchParams.get("kind") || ""; // "" | workflow | prompt
    const creator = searchParams.get("creator") || ""; // search by name/handle
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const supabase = createSupabaseAdminClient();

    // Build runs query with creator filter
    let runsQuery = supabase
      .from("runs")
      .select(
        `
        id,
        kind,
        workflow_id,
        prompt_id,
        version_id,
        runner_user_id,
        creator_user_id,
        started_at,
        ended_at,
        status,
        error_code,
        error_message,
        duration_ms,
        tokens_in,
        tokens_out,
        model,
        metadata,
        created_at
      `,
        { count: "exact" }
      )
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (kind === "workflow" || kind === "prompt") {
      runsQuery = runsQuery.eq("kind", kind);
    }

    // If creator search: resolve user IDs first
    let creatorUserIds: string[] | null = null;
    if (creator.trim()) {
      const term = creator.trim().toLowerCase().replace(/^@/, "");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`handle.ilike.%${term}%,full_name.ilike.%${term}%`);
      creatorUserIds = (profiles ?? []).map((p: { id: string }) => p.id);
      if (creatorUserIds.length === 0) {
        // No matching creators - return empty
        return NextResponse.json({
          runs: [],
          total: 0,
          page,
          limit,
          aggregates: {
            totalRuns: 0,
            workflowRuns: 0,
            promptRuns: 0,
            successCount: 0,
            errorCount: 0,
            successRate: 0,
          },
          timeSeries: { workflow: [], prompt: [], total: [] },
        });
      }
      runsQuery = runsQuery.in("creator_user_id", creatorUserIds);
    }

    const { data: runs, error: runsError, count } = await runsQuery;

    if (runsError) {
      return NextResponse.json(
        { error: runsError.message },
        { status: 500 }
      );
    }

    // Resolve creator profiles for runs
    const creatorIds = [...new Set((runs ?? []).map((r: { creator_user_id?: string | null }) => r.creator_user_id).filter(Boolean))] as string[];
    const { data: profiles } = creatorIds.length
      ? await supabase.from("profiles").select("id, handle, full_name").in("id", creatorIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p: { id: string; handle?: string; full_name?: string }) => [p.id, p]));

    const enrichedRuns = (runs ?? []).map((r: Record<string, unknown>) => {
      const creatorProfile = r.creator_user_id ? profileMap.get(r.creator_user_id as string) : null;
      return {
        ...r,
        creator_handle: creatorProfile?.handle ?? null,
        creator_name: creatorProfile?.full_name ?? null,
      };
    });

    // Aggregates (only completed runs: ended_at exists, status in success/error/canceled)
    let aggQuery = supabase
      .from("runs")
      .select("kind, status")
      .gte("started_at", sinceIso)
      .not("ended_at", "is", null)
      .in("status", ["success", "error", "canceled"]);
    if (kind) aggQuery = aggQuery.eq("kind", kind);
    if (creatorUserIds?.length) aggQuery = aggQuery.in("creator_user_id", creatorUserIds);
    const { data: aggRows } = await aggQuery;

    const totalRuns = aggRows?.length ?? 0;
    const workflowRuns = aggRows?.filter((r: { kind: string }) => r.kind === "workflow").length ?? 0;
    const promptRuns = aggRows?.filter((r: { kind: string }) => r.kind === "prompt").length ?? 0;
    const successCount = aggRows?.filter((r: { status: string }) => r.status === "success").length ?? 0;
    const errorCount = aggRows?.filter((r: { status: string }) => r.status === "error").length ?? 0;
    const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;

    // Time series: daily buckets
    let bucketQuery = supabase
      .from("runs")
      .select("kind, started_at")
      .gte("started_at", sinceIso)
      .not("ended_at", "is", null)
      .in("status", ["success", "error", "canceled"]);
    if (kind) bucketQuery = bucketQuery.eq("kind", kind);
    if (creatorUserIds?.length) bucketQuery = bucketQuery.in("creator_user_id", creatorUserIds);
    const { data: bucketRows } = await bucketQuery;

    const buckets = new Map<string, { workflow: number; prompt: number }>();
    for (let d = 0; d < days; d++) {
      const date = new Date(since);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, { workflow: 0, prompt: 0 });
    }
    for (const row of bucketRows ?? []) {
      const key = (row.started_at as string).slice(0, 10);
      const b = buckets.get(key) ?? { workflow: 0, prompt: 0 };
      if (row.kind === "workflow") b.workflow++;
      else if (row.kind === "prompt") b.prompt++;
      buckets.set(key, b);
    }
    const sortedKeys = [...buckets.keys()].sort();
    const timeSeries = {
      workflow: sortedKeys.map((k) => ({ date: k, count: buckets.get(k)!.workflow })),
      prompt: sortedKeys.map((k) => ({ date: k, count: buckets.get(k)!.prompt })),
      total: sortedKeys.map((k) => {
        const b = buckets.get(k)!;
        return { date: k, count: b.workflow + b.prompt };
      }),
    };

    return NextResponse.json({
      runs: enrichedRuns,
      total: count ?? 0,
      page,
      limit,
      aggregates: {
        totalRuns,
        workflowRuns,
        promptRuns,
        successCount,
        errorCount,
        successRate,
      },
      timeSeries,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
