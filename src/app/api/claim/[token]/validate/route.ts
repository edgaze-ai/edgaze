import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/creator-provisioning/tokens";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    if (!token) {
      return NextResponse.json({ valid: false, reason: "invalid" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const tokenHash = await hashToken(token);

    const { data: link, error } = await admin
      .from("creator_claim_links")
      .select("id, profile_id, target_email, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !link) {
      return NextResponse.json({ valid: false, reason: "invalid", invite: null });
    }

    const row = link as {
      id: string;
      profile_id: string;
      target_email: string | null;
      status: string;
      expires_at: string;
    };

    if (row.status === "revoked") {
      return NextResponse.json({ valid: false, reason: "revoked", invite: null });
    }

    if (row.status === "consumed") {
      return NextResponse.json({ valid: false, reason: "consumed", invite: null });
    }

    if (row.status === "expired" || new Date(row.expires_at) < new Date()) {
      if (row.status === "active") {
        await admin.from("creator_claim_links").update({ status: "expired" }).eq("id", row.id);
      }
      return NextResponse.json({ valid: false, reason: "expired", invite: null });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, handle, full_name, avatar_url, banner_url, claim_status, source")
      .eq("id", row.profile_id)
      .maybeSingle();

    const p = profile as {
      handle: string;
      full_name: string | null;
      avatar_url: string | null;
      banner_url: string | null;
      claim_status: string;
    } | null;

    if (!p) {
      return NextResponse.json({ valid: false, reason: "invalid", invite: null });
    }

    if (p.claim_status === "claimed") {
      return NextResponse.json({
        valid: false,
        reason: "already_claimed",
        invite: {
          handle: p.handle,
          full_name: p.full_name,
        },
      });
    }

    const openClaim = !row.target_email?.trim();

    return NextResponse.json({
      valid: true,
      invite: {
        profile_id: row.profile_id,
        open_claim: openClaim,
        target_email_masked: row.target_email ? maskEmail(row.target_email) : null,
        creator_name: p.full_name ?? p.handle,
        creator_photo_url: p.avatar_url,
        custom_message: openClaim
          ? "First to sign in with this link claims this workspace. The link then stops working."
          : "Edgaze prepared this workspace for you.",
        status: row.status,
        expires_at: row.expires_at,
        handle: p.handle,
        banner_url: p.banner_url,
      },
    });
  } catch (e: any) {
    console.error("[claim/validate]", e);
    return NextResponse.json({ valid: false, reason: "invalid" }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  const show = (u ?? "").slice(0, 2);
  return `${show}***@${d}`;
}
