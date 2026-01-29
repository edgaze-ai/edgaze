import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { getUserFromRequest } from "../../_auth";
import { getUserWorkflowRunCount, workflowExists, getWorkflowDraftId } from "@lib/supabase/executions";

const FREE_BUILDER_RUNS = 10;

/**
 * GET /api/flow/run/diagnostic?workflowId=...
 * Returns diagnostic information about run tracking for debugging.
 * Requires auth via Authorization: Bearer <accessToken>.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: authError ?? "Sign in required" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Check if it's a draft (for builder test runs)
    // Always check drafts first - workflowId might be a draft ID
    let draftId: string | null = await getWorkflowDraftId(workflowId, userId);
    const exists = draftId ? false : await workflowExists(workflowId);

    // Get current run count
    let currentCount = 0;
    let error: string | null = null;
    try {
      // If draftId found, use it; otherwise use workflowId
      // getUserWorkflowRunCount checks draftId first, so passing workflowId is fine even if it's a draft ID
      currentCount = await getUserWorkflowRunCount(userId, workflowId, draftId);
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : "Failed to get run count";
      console.error("[Diagnostic] Error getting run count:", err);
    }

    // Get last run for this workflow/draft (use service client for DB read)
    let lastRunId: string | null = null;
    let lastRunStatus: string | null = null;
    let lastRunCreatedAt: string | null = null;
    let lastRunUpdatedAt: string | null = null;

    try {
      const supabase = createSupabaseAdminClient();
      let query = supabase
        .from("workflow_runs")
        .select("id, status, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (draftId) {
        query = query.eq("draft_id", draftId);
      } else {
        query = query.eq("workflow_id", workflowId);
      }
      
      const { data: lastRun, error: lastRunErr } = await query.maybeSingle();

      if (!lastRunErr && lastRun) {
        lastRunId = lastRun.id;
        lastRunStatus = lastRun.status;
        lastRunCreatedAt = lastRun.created_at;
        lastRunUpdatedAt = lastRun.updated_at;
      }
    } catch (err: unknown) {
      console.error("[Diagnostic] Error getting last run:", err);
      if (!error) {
        error = `Failed to get last run: ${err instanceof Error ? err.message : "Unknown error"}`;
      }
    }

    return NextResponse.json({
      ok: true,
      diagnostic: {
        workflowId,
        userId,
        currentCount,
        limit: FREE_BUILDER_RUNS,
        lastRunId,
        lastRunStatus,
        lastRunCreatedAt,
        lastRunUpdatedAt,
        error,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
