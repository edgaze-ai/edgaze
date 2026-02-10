// src/app/api/me/remove-listing/route.ts
// Authenticated owner can remove their own prompt/workflow from marketplace (soft remove).

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
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

    const body = await req.json();
    const { kind, id } = body;

    if (!kind || !["prompt", "workflow"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const table = kind === "prompt" ? "prompts" : "workflows";

    const { data: row, error: fetchError } = await supabase
      .from(table)
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const ownerId = row.owner_id;
    const isOwner =
      ownerId != null && String(ownerId).toLowerCase() === String(user.id).toLowerCase();

    if (!isOwner) {
      return NextResponse.json({ error: "Not the owner of this listing" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({
        removed_at: new Date().toISOString(),
        removed_reason: "Removed by owner",
        removed_by: "owner",
      })
      .eq("id", id);

    if (updateError) {
      console.error("Remove listing update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Remove listing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
