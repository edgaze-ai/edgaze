import { NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

/**
 * Check if the user can change their handle (60-day cooldown enforced)
 */
export async function GET(req: Request) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    
    // Call the database function to check handle change eligibility
    const { data, error } = await admin.rpc("can_change_handle", {
      user_id_input: user.id,
    });

    if (error) {
      console.error("[check-handle-change] Error:", error);
      return NextResponse.json(
        { error: "Failed to check handle change status" },
        { status: 500 }
      );
    }

    // The function returns an array with one row
    const result = data?.[0];
    
    if (!result) {
      return NextResponse.json(
        { error: "No data returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      canChange: result.can_change,
      lastChangedAt: result.last_changed_at,
      nextAllowedAt: result.next_allowed_at,
      daysRemaining: result.days_remaining,
    });
  } catch (e) {
    console.error("[check-handle-change] unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
