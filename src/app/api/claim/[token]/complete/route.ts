import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/creator-provisioning/tokens";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

function normEmail(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { user } = await getUserAndClient(req);
    if (!user?.id || !normEmail(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await ctx.params;
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const tokenHash = await hashToken(token);

    const { data: link, error: lErr } = await admin
      .from("creator_claim_links")
      .select("id, profile_id, target_email, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (lErr || !link) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const row = link as {
      id: string;
      profile_id: string;
      target_email: string;
      status: string;
      expires_at: string;
    };

    if (row.status !== "active") {
      return NextResponse.json({ error: "Link is no longer active" }, { status: 400 });
    }

    if (new Date(row.expires_at) < new Date()) {
      await admin.from("creator_claim_links").update({ status: "expired" }).eq("id", row.id);
      return NextResponse.json({ error: "Link expired" }, { status: 400 });
    }

    const targetEmail = normEmail(row.target_email);
    const userEmail = normEmail(user.email);

    if (userEmail !== targetEmail) {
      return NextResponse.json(
        {
          error: "email_mismatch",
          message: "Signed-in account email does not match this claim link.",
        },
        { status: 403 },
      );
    }

    if (user.id !== row.profile_id) {
      return NextResponse.json(
        {
          error: "identity_mismatch",
          message:
            "Your account does not match the provisioned workspace. Use the account created for this invite, or contact support.",
        },
        { status: 403 },
      );
    }

    const { error: upProf } = await admin
      .from("profiles")
      .update({
        claim_status: "claimed",
        claimed_at: new Date().toISOString(),
      })
      .eq("id", row.profile_id)
      .eq("claim_status", "unclaimed");

    if (upProf) {
      console.error(upProf);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    await admin
      .from("creator_claim_links")
      .update({
        status: "consumed",
        consumed_at: new Date().toISOString(),
        consumed_by_user_id: user.id,
      })
      .eq("id", row.id);

    const { data: existingOb } = await admin
      .from("creator_onboarding")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingOb) {
      await admin.from("creator_onboarding").insert({
        user_id: user.id,
        invite_id: null,
        step: "profile",
        profile_completed: false,
      });
    }

    await logCreatorAuditEvent({
      action: "creator.account.claimed",
      actorUserId: user.id,
      actorRole: "creator",
      actorMode: "creator_self",
      effectiveProfileId: row.profile_id,
      resourceType: "profile",
      resourceId: row.profile_id,
      metadata: { claim_link_id: row.id },
    });

    return NextResponse.json({ ok: true, profile_id: row.profile_id });
  } catch (e: any) {
    console.error("[claim/complete]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
