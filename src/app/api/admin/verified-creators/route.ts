import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendVerifiedCreatorEmail } from "@/lib/email/sendVerifiedCreatorEmail";

/**
 * POST { profileId: string, is_verified_creator: boolean }
 * Updates verified status. When transitioning to verified, sends transactional email (Resend).
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const nextVerified = Boolean(body?.is_verified_creator);

    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: row, error: fetchErr } = await admin
      .from("profiles")
      .select("id, email, full_name, handle, is_verified_creator")
      .eq("id", profileId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const prev = Boolean((row as { is_verified_creator?: boolean | null }).is_verified_creator);

    const { error: upErr } = await admin
      .from("profiles")
      .update({ is_verified_creator: nextVerified })
      .eq("id", profileId);

    if (upErr) {
      console.error("[admin/verified-creators]", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    let emailSent = false;
    let emailSkippedNoAddress = false;
    let emailError: string | undefined;

    if (nextVerified && !prev) {
      let recipient = (row as { email?: string | null }).email?.trim() || "";
      if (!recipient.includes("@")) {
        const { data: authData, error: authLookupErr } =
          await admin.auth.admin.getUserById(profileId);
        if (authLookupErr) {
          console.warn("[admin/verified-creators] auth email lookup:", authLookupErr.message);
        }
        recipient = (authData?.user?.email ?? "").trim();
      }

      if (!recipient.includes("@")) {
        emailSkippedNoAddress = true;
      } else {
        const r = await sendVerifiedCreatorEmail({
          to: recipient,
          fullName: (row as { full_name?: string | null }).full_name ?? null,
          handle: (row as { handle?: string | null }).handle ?? null,
        });
        emailSent = r.ok;
        if (!r.ok) {
          emailError = r.error;
          console.warn("[admin/verified-creators] email not sent:", r.error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      is_verified_creator: nextVerified,
      email_sent: emailSent,
      email_skipped_no_address: emailSkippedNoAddress,
      ...(emailError ? { email_error: emailError } : {}),
    });
  } catch (e: unknown) {
    console.error("[admin/verified-creators]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
