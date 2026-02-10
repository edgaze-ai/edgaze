// src/app/api/admin/takedown/route.ts
// Admin-only: set removed_at, removed_reason, removed_by = 'admin' for a prompt or workflow.

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

    const body = await req.json();
    const { target_type, target_id, reason } = body;

    if (!target_type || !["prompt", "workflow"].includes(target_type)) {
      return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
    }
    if (!target_id || typeof target_id !== "string") {
      return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const table = target_type === "prompt" ? "prompts" : "workflows";

    const { error } = await supabase
      .from(table)
      .update({
        removed_at: new Date().toISOString(),
        removed_reason: reason.trim(),
        removed_by: "admin",
      })
      .eq("id", target_id);

    if (error) {
      console.error("Takedown update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Takedown error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
