import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { getUserWorkflowRunCount, isAdmin } from "@lib/supabase/executions";
import { getAuthenticatedRunEntitlement } from "src/server/flow/marketplace-entitlement";

const BUILDER_TEST_RUN_LIMIT = 10;
const MARKETPLACE_KEY_RUN_LIMIT = 10;

/**
 * GET /api/flow/run/remaining?workflowId=...&isBuilderTest=1&isPreview=1
 * Requires auth. isBuilderTest / isPreview are hints; effective caps come from server entitlement.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");
    const isBuilderTestParam =
      searchParams.get("isBuilderTest") === "1" || searchParams.get("isBuilderTest") === "true";

    if (!workflowId) {
      return NextResponse.json({ ok: false, error: "workflowId is required" }, { status: 400 });
    }

    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: authError ?? "Sign in required" },
        { status: 401 },
      );
    }

    const userId = user.id;

    const entitlement = await getAuthenticatedRunEntitlement(
      userId,
      workflowId,
      isBuilderTestParam,
    );
    if (entitlement.ok === false) {
      return NextResponse.json({ ok: false, error: entitlement.message }, { status: 403 });
    }

    const draftId = entitlement.draftIdForCount;
    const limit = entitlement.effectiveIsBuilderTest
      ? BUILDER_TEST_RUN_LIMIT
      : MARKETPLACE_KEY_RUN_LIMIT;
    const used = await getUserWorkflowRunCount(userId, workflowId, draftId);
    const freeRunsRemaining = Math.max(0, limit - used);

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
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
