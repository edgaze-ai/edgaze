import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/creator-provisioning/tokens";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import { transferProvisionedWorkspaceToClaimant } from "@/lib/creator-provisioning/claim-transfer";

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
      target_email: string | null;
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

    const lockedEmail = row.target_email ? normEmail(row.target_email) : null;
    const userEmail = normEmail(user.email);
    if (lockedEmail && userEmail !== lockedEmail) {
      return NextResponse.json(
        {
          error: "email_mismatch",
          message: "Signed-in account email does not match this claim link.",
        },
        { status: 403 },
      );
    }

    const { data: profile, error: pReadErr } = await admin
      .from("profiles")
      .select("id, claim_status, source")
      .eq("id", row.profile_id)
      .maybeSingle();

    if (pReadErr || !profile) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const prof = profile as { id: string; claim_status: string; source: string };
    if (prof.claim_status === "claimed" && user.id === prof.id) {
      await admin
        .from("creator_claim_links")
        .update({
          status: "consumed",
          consumed_at: new Date().toISOString(),
          consumed_by_user_id: user.id,
        })
        .eq("id", row.id);
      return NextResponse.json({ ok: true, profile_id: prof.id, resumed: true });
    }

    if (prof.claim_status === "claimed") {
      return NextResponse.json(
        { error: "already_claimed", message: "This workspace has already been claimed." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    if (user.id === row.profile_id) {
      const { error: upProf } = await admin
        .from("profiles")
        .update({
          claim_status: "claimed",
          claimed_at: now,
          email: userEmail,
        })
        .eq("id", row.profile_id)
        .eq("claim_status", "unclaimed");

      if (upProf) {
        console.error(upProf);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }
    } else {
      const { data: linkAgain } = await admin
        .from("creator_claim_links")
        .select("id, status, profile_id")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      const la = linkAgain as { id: string; status: string; profile_id: string } | null;
      if (!la || la.id !== row.id || la.status !== "active") {
        return NextResponse.json(
          {
            error: "Link is no longer active",
            message: "Refresh and try again, or use a new link.",
          },
          { status: 409 },
        );
      }

      const { data: profAgain } = await admin
        .from("profiles")
        .select("claim_status, source")
        .eq("id", la.profile_id)
        .maybeSingle();

      const pa = profAgain as { claim_status: string; source: string } | null;
      if (!pa || pa.claim_status !== "unclaimed" || pa.source !== "admin_provisioned") {
        return NextResponse.json(
          {
            error: "already_claimed",
            message: "This workspace was just claimed. Only one person can use this link.",
          },
          { status: 409 },
        );
      }

      const t = await transferProvisionedWorkspaceToClaimant({
        admin,
        oldProfileId: la.profile_id,
        newUserId: user.id,
        claimerEmail: user.email!,
      });

      if (!t.ok) {
        return NextResponse.json({ error: t.error }, { status: t.status });
      }
    }

    await admin
      .from("creator_claim_links")
      .update({
        status: "consumed",
        consumed_at: now,
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
      effectiveProfileId: user.id,
      resourceType: "profile",
      resourceId: user.id,
      metadata: { claim_link_id: row.id, prior_profile_id: row.profile_id },
    });

    return NextResponse.json({ ok: true, profile_id: user.id });
  } catch (e: any) {
    console.error("[claim/complete]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
