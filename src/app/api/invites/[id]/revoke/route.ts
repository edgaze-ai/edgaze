// POST /api/invites/[id]/revoke - Revoke an invite (admin only)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { revokeInvite } from "@/lib/invites";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminRole) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Revoke the invite
    const result = await revokeInvite(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error revoking invite:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
