import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeSocials, sanitizeUrl } from "@/lib/sanitize-url";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ profileId: string }> }) {
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

    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: links } = await admin
      .from("creator_claim_links")
      .select(
        "id, status, target_email, sent_at, expires_at, consumed_at, consumed_by_user_id, revoked_at",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: auditEvents } = await admin
      .from("creator_audit_events")
      .select("id, action, actor_mode, actor_user_id, created_at, metadata")
      .eq("effective_profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: impersonationSessions } = await admin
      .from("admin_impersonation_sessions")
      .select("id, admin_user_id, status, reason, started_at, ended_at, expires_at, ended_reason")
      .eq("target_profile_id", profileId)
      .order("started_at", { ascending: false })
      .limit(20);

    const { data: connectAccount } = await admin
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, account_status, payouts_enabled, charges_enabled, details_submitted, onboarding_completed_at, updated_at",
      )
      .eq("user_id", profileId)
      .maybeSingle();

    const { data: pendingClaimRows } = await admin
      .from("creator_earnings")
      .select("id, net_amount_cents, claim_deadline_at")
      .eq("creator_id", profileId)
      .eq("status", "pending_claim")
      .order("claim_deadline_at", { ascending: true });

    const now = new Date();
    const pendingClaimCents = (pendingClaimRows ?? []).reduce(
      (sum, row) => sum + Math.max(0, row.net_amount_cents || 0),
      0,
    );
    const claimDeadline =
      pendingClaimRows?.find((row) => row.claim_deadline_at)?.claim_deadline_at ?? null;
    const daysRemaining = claimDeadline
      ? Math.max(
          0,
          Math.ceil((new Date(claimDeadline).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : 0;

    const { data: firstSaleEmail } = await admin
      .from("creator_pending_claim_email_log")
      .select("sent_at")
      .eq("creator_id", profileId)
      .eq("email_type", "first_sale")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: feeOverrides } = await admin
      .from("creator_platform_fee_overrides")
      .select(
        "id, platform_fee_percentage, starts_at, ends_at, reason, created_at, revoked_at, revoked_by_admin_id",
      )
      .eq("creator_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20);

    const activeFeeOverride =
      feeOverrides?.find(
        (row) =>
          !row.revoked_at &&
          new Date(row.starts_at).getTime() <= now.getTime() &&
          new Date(row.ends_at).getTime() > now.getTime(),
      ) ?? null;

    return NextResponse.json({
      profile,
      claim_links: links ?? [],
      audit_events: auditEvents ?? [],
      impersonation_sessions: impersonationSessions ?? [],
      connect_account: connectAccount ?? null,
      pending_claim_summary: {
        pendingClaimCents,
        claimCount: pendingClaimRows?.length ?? 0,
        claimDeadline,
        daysRemaining,
        firstSaleEmailSentAt: firstSaleEmail?.sent_at ?? null,
      },
      active_fee_override: activeFeeOverride,
      fee_override_history: feeOverrides ?? [],
    });
  } catch (e: any) {
    console.error("[admin/creators/[id] GET]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ profileId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { profileId } = await ctx.params;
    const body = await req.json();
    const admin = createSupabaseAdminClient();

    const updatePayload: Record<string, unknown> = {};
    if (body.full_name != null)
      updatePayload.full_name = String(body.full_name).slice(0, 120) || null;
    if (body.handle != null) {
      const h = String(body.handle)
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 24);
      if (!/^[a-z0-9_]{3,24}$/.test(h)) {
        return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
      }
      updatePayload.handle = h;
    }
    if (body.bio != null) updatePayload.bio = String(body.bio).slice(0, 1000) || null;
    if (body.avatar_url != null) {
      const s = sanitizeUrl(body.avatar_url);
      updatePayload.avatar_url = s ? s.slice(0, 2000) : null;
    }
    if (body.banner_url != null) {
      const s = sanitizeUrl(body.banner_url);
      updatePayload.banner_url = s ? s.slice(0, 2000) : null;
    }
    if (body.socials != null) {
      updatePayload.socials = sanitizeSocials(body.socials) ?? {};
    }

    const { error: upErr } = await admin.from("profiles").update(updatePayload).eq("id", profileId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "creator.profile.updated_by_admin",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: profileId,
      resourceType: "profile",
      resourceId: profileId,
      metadata: { fields: Object.keys(updatePayload) },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[admin/creators/[id] PATCH]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
