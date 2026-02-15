// src/app/api/admin/refill-workflow-runs/route.ts
// Admin-only: delete workflow_runs for a user (and optional workflow) to "refill" their free run count.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { username, workflowId } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const handle = username.trim().toLowerCase().replace(/^@/, "");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = profile.id;

    let query = supabase
      .from("workflow_runs")
      .delete()
      .eq("user_id", userId);

    if (workflowId && typeof workflowId === "string" && workflowId.trim()) {
      query = query.eq("workflow_id", workflowId.trim());
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      console.error("[refill-workflow-runs] Delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: workflowId?.trim()
        ? `Workflow runs refilled for @${handle} on workflow ${workflowId}. Run count reset.`
        : `Workflow runs refilled for @${handle}. All run counts reset.`,
      userId,
      workflowId: workflowId?.trim() || null,
    });
  } catch (error: unknown) {
    console.error("Refill workflow runs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
