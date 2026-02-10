import { NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

/**
 * After profile handle (or full_name) is updated, cascade to workflows, prompts, and comments
 * so product pages, marketplace cards, and links show the new handle everywhere.
 * Uses service role so updates are not blocked by RLS.
 */
export async function POST(req: Request) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: { oldHandle?: string } = {};
    try {
      body = await req.json();
    } catch {
      // no body is ok
    }

    const admin = createSupabaseAdminClient();
    const userId = user.id;

    // So old profile/product URLs redirect: record old handle when it changed
    const oldHandleRaw = body?.oldHandle;
    if (oldHandleRaw && typeof oldHandleRaw === "string") {
      const oldHandle = oldHandleRaw.trim().toLowerCase();
      if (oldHandle) {
        await admin.from("handle_history").insert({
          user_id: userId,
          old_handle: oldHandle,
        });

        // Update the last changed timestamp for 60-day cooldown enforcement
        await admin
          .from("profiles")
          .update({ handle_last_changed_at: new Date().toISOString() })
          .eq("id", userId);
      }
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("handle, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.handle) {
      return NextResponse.json(
        { error: "Profile not found or handle missing" },
        { status: 400 }
      );
    }

    const handle = profile.handle;
    const fullName = profile.full_name ?? null;
    const userIdStr = String(userId);

    // Cascade to ALL workflows for this user (owner_id is uuid) – includes older posts
    const { error: eWorkflows } = await admin
      .from("workflows")
      .update({
        owner_handle: handle,
        owner_name: fullName,
      })
      .eq("owner_id", userId);

    if (eWorkflows) {
      console.error("[cascade-handle] workflows update failed:", eWorkflows);
      return NextResponse.json(
        { error: "Failed to update workflows" },
        { status: 500 }
      );
    }

    // Cascade to ALL prompts for this user (owner_id is text) – includes older posts
    const { error: ePrompts } = await admin
      .from("prompts")
      .update({
        owner_handle: handle,
        owner_name: fullName,
      })
      .eq("owner_id", userIdStr);

    if (ePrompts) {
      console.error("[cascade-handle] prompts update failed:", ePrompts);
      return NextResponse.json(
        { error: "Failed to update prompts" },
        { status: 500 }
      );
    }

    // Cascade to workflow_comments (user_id is text)
    await admin
      .from("workflow_comments")
      .update({ user_handle: handle })
      .eq("user_id", userIdStr);

    // Cascade to prompt_comments (user_id is text)
    await admin
      .from("prompt_comments")
      .update({ user_handle: handle })
      .eq("user_id", userIdStr);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cascade-handle] unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
