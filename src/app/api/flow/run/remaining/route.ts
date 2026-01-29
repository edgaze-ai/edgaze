import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../_auth";
import { getUserWorkflowRunCount, isAdmin, workflowExists, getWorkflowDraftId } from "@lib/supabase/executions";

const BUILDER_TEST_RUN_LIMIT = 10;

/**
 * GET /api/flow/run/remaining?workflowId=...&isBuilderTest=1
 * Returns { used, limit, freeRunsRemaining } for builder test runs.
 * Requires auth via Authorization: Bearer <accessToken>.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");
    const isBuilderTest = searchParams.get("isBuilderTest") === "1" || searchParams.get("isBuilderTest") === "true";

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

    // Always fetch actual usage so the UI shows real run counts (used goes up)
    // Check drafts if workflow doesn't exist (builder test runs)
    let draftId: string | null = null;
    if (isBuilderTest) {
      const exists = await workflowExists(workflowId);
      if (!exists) {
        draftId = await getWorkflowDraftId(workflowId, userId);
      }
    }
    const limit = isBuilderTest ? BUILDER_TEST_RUN_LIMIT : 5;
    const used = await getUserWorkflowRunCount(userId, workflowId, draftId);
    const freeRunsRemaining = Math.max(0, limit - used);

    // Admins get unlimited limit but we still return real usage for display
    const userIsAdmin = await isAdmin(userId);
    if (userIsAdmin) {
      return NextResponse.json({
        ok: true,
        used,
        limit: 999999,
        freeRunsRemaining: 999999,
        isAdmin: true,
      });
    }

    return NextResponse.json({
      ok: true,
      used,
      limit,
      freeRunsRemaining,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
