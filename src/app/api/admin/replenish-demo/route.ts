// src/app/api/admin/replenish-demo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../flow/_auth";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    // Auth: Bearer token only (client sends Authorization: Bearer <accessToken>)
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError ?? "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const body = await req.json();
    const { username, workflowId } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    // Find user by handle (username)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", username.trim().toLowerCase().replace(/^@/, ""))
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = profile.id;

    // Reset demo runs
    if (workflowId) {
      // Reset for specific workflow
      const { error: deleteError } = await supabase
        .from("demo_runs")
        .delete()
        .eq("user_id", userId)
        .eq("workflow_id", workflowId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Demo runs replenished for user @${username} on workflow ${workflowId}`,
        userId,
        workflowId,
      });
    } else {
      // Reset all demo runs for user
      const { error: deleteError } = await supabase
        .from("demo_runs")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `All demo runs replenished for user @${username}`,
        userId,
      });
    }
  } catch (error: any) {
    console.error("Replenish demo error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
