// Revoke invite
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { id } = await params;

    // Update invite status
    const { error: updateError } = await supabase
      .from("creator_invites")
      .update({ status: "revoked" })
      .eq("id", id);

    if (updateError) {
      console.error("[API revoke] Error:", updateError);
      return NextResponse.json(
        {
          error: updateError.message,
          code: updateError.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API revoke] Exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
