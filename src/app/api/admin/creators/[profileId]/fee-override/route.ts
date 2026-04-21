import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";

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
    const durationDays = Math.max(1, Math.min(365, Number(body.durationDays) || 90));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : "Admin launch fee holiday";
    const admin = createSupabaseAdminClient();
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    await admin
      .from("creator_platform_fee_overrides")
      .update({
        revoked_at: nowIso,
        revoked_by_admin_id: user.id,
      })
      .eq("creator_id", profileId)
      .is("revoked_at", null)
      .gt("ends_at", nowIso);

    const { data, error } = await admin
      .from("creator_platform_fee_overrides")
      .insert({
        creator_id: profileId,
        platform_fee_percentage: 0,
        starts_at: nowIso,
        ends_at: endsAt,
        reason,
        created_by_admin_id: user.id,
      })
      .select("id, platform_fee_percentage, starts_at, ends_at, reason")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "creator.platform_fee_override.granted",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: profileId,
      resourceType: "creator_platform_fee_override",
      resourceId: data.id,
      metadata: {
        platform_fee_percentage: 0,
        starts_at: nowIso,
        ends_at: endsAt,
        duration_days: durationDays,
        reason,
      },
    });

    return NextResponse.json({ ok: true, override: data });
  } catch (e: any) {
    console.error("[admin/creators/[id]/fee-override POST]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

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
    const nowIso = new Date().toISOString();

    const { data: activeOverride, error: lookupError } = await admin
      .from("creator_platform_fee_overrides")
      .select("id, platform_fee_percentage, starts_at, ends_at, reason")
      .eq("creator_id", profileId)
      .is("revoked_at", null)
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!activeOverride) {
      return NextResponse.json({ ok: true, override: null });
    }

    const { error } = await admin
      .from("creator_platform_fee_overrides")
      .update({
        revoked_at: nowIso,
        revoked_by_admin_id: user.id,
      })
      .eq("id", activeOverride.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logCreatorAuditEvent({
      action: "creator.platform_fee_override.revoked",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: profileId,
      resourceType: "creator_platform_fee_override",
      resourceId: activeOverride.id,
      metadata: {
        revoked_at: nowIso,
      },
    });

    return NextResponse.json({ ok: true, override: null });
  } catch (e: any) {
    console.error("[admin/creators/[id]/fee-override DELETE]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
