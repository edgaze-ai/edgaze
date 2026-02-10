import { NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

/**
 * Update user profile with server-side validation
 * Enforces 60-day cooldown for handle changes
 */
export async function POST(req: Request) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { handle, full_name, avatar_url, banner_url, bio, socials } = body;

    // If handle is being changed, enforce 60-day cooldown
    if (handle !== undefined) {
      const admin = createSupabaseAdminClient();
      
      // Get current profile to compare handles
      const { data: currentProfile } = await admin
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .single();

      // Only check cooldown if handle is actually changing
      if (currentProfile?.handle !== handle) {
        // Check if handle change is allowed
        const { data: cooldownCheck, error: cooldownError } = await admin.rpc(
          "can_change_handle",
          { user_id_input: user.id }
        );

        if (cooldownError) {
          console.error("[profile/update] Cooldown check failed:", cooldownError);
          return NextResponse.json(
            { error: "Failed to check handle change status" },
            { status: 500 }
          );
        }

        const result = cooldownCheck?.[0];
        if (!result?.can_change) {
          return NextResponse.json(
            {
              error: `Handle changes are limited to once every 60 days. You can change your handle again in ${result?.days_remaining ?? "N/A"} day(s).`,
              daysRemaining: result?.days_remaining ?? 0,
            },
            { status: 429 } // Too Many Requests
          );
        }
      }
    }

    // Build update payload
    const updatePayload: Record<string, any> = {};
    if (handle !== undefined) updatePayload.handle = handle;
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
    if (banner_url !== undefined) updatePayload.banner_url = banner_url;
    if (bio !== undefined) updatePayload.bio = bio;
    if (socials !== undefined) updatePayload.socials = socials;

    // Update profile using admin client (bypasses RLS)
    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (updateError) {
      console.error("[profile/update] Update failed:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[profile/update] Unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
