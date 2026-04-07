import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken, generateOpaqueToken } from "@/lib/creator-provisioning/tokens";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import { getSiteOrigin } from "@/lib/site-origin";

export async function POST(req: NextRequest, ctx: { params: Promise<{ profileId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { profileId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const target_email = String((body as { target_email?: string }).target_email ?? "")
      .trim()
      .toLowerCase();
    const expires_in_days = Number((body as { expires_in_days?: number }).expires_in_days) || 14;

    if (!target_email) {
      return NextResponse.json({ error: "target_email required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, claim_status, email")
      .eq("id", profileId)
      .maybeSingle();

    if (pErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if ((profile as { claim_status?: string }).claim_status === "claimed") {
      return NextResponse.json({ error: "Profile already claimed" }, { status: 400 });
    }

    const { data: activeLinks } = await admin
      .from("creator_claim_links")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "active");

    for (const row of activeLinks ?? []) {
      await admin
        .from("creator_claim_links")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by_admin_id: user.id,
        })
        .eq("id", (row as { id: string }).id);
    }

    const rawToken = generateOpaqueToken() + generateOpaqueToken();
    const tokenHash = await hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const { data: link, error: insErr } = await admin
      .from("creator_claim_links")
      .insert({
        profile_id: profileId,
        target_email,
        token_hash: tokenHash,
        sent_by_admin_id: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, expires_at, sent_at")
      .single();

    if (insErr || !link) {
      console.error(insErr);
      return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "creator.claim_link.sent",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: profileId,
      resourceType: "creator_claim_links",
      resourceId: (link as { id: string }).id,
      metadata: { target_email_domain: target_email.split("@")[1] ?? "" },
    });

    const origin = getSiteOrigin();
    const claimUrl = `${origin}/claim/${rawToken}`;

    return NextResponse.json({
      claimUrl,
      link_id: (link as { id: string }).id,
      expires_at: (link as { expires_at: string }).expires_at,
    });
  } catch (e: any) {
    console.error("[claim-links POST]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

/** Revoke the active claim link for this profile (if any). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ profileId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { profileId } = await ctx.params;
    const admin = createSupabaseAdminClient();

    const { data: activeLinks } = await admin
      .from("creator_claim_links")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "active");

    const now = new Date().toISOString();
    for (const row of activeLinks ?? []) {
      const id = (row as { id: string }).id;
      await admin
        .from("creator_claim_links")
        .update({
          status: "revoked",
          revoked_at: now,
          revoked_by_admin_id: user.id,
        })
        .eq("id", id);
      await logCreatorAuditEvent({
        action: "creator.claim_link.revoked",
        actorUserId: user.id,
        actorRole: "super_admin",
        actorMode: "admin_direct",
        effectiveProfileId: profileId,
        resourceType: "creator_claim_links",
        resourceId: id,
        metadata: {},
      });
    }

    return NextResponse.json({ ok: true, revoked: (activeLinks ?? []).length });
  } catch (e: any) {
    console.error("[claim-links DELETE]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
