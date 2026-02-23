// src/app/api/admin/runs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: run, error: runError } = await supabase
      .from("runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (runError || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Fetch creator profile
    let creatorProfile = null;
    if (run.creator_user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, full_name, avatar_url")
        .eq("id", run.creator_user_id)
        .maybeSingle();
      creatorProfile = data;
    }

    // Fetch workflow_run_nodes if this is a workflow run with workflow_run_id
    let nodeLogs: unknown[] = [];
    if (run.workflow_run_id) {
      const { data } = await supabase
        .from("workflow_run_nodes")
        .select("node_id, spec_id, status, started_at, ended_at, duration_ms, error_message, tokens_used, model, retries")
        .eq("workflow_run_id", run.workflow_run_id)
        .order("started_at", { ascending: true });
      nodeLogs = data ?? [];
    }

    return NextResponse.json({
      run: { ...run, creator_profile: creatorProfile },
      nodeLogs,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
