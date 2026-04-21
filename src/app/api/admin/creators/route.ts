import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseErrorForDisplay, flattenSupabaseError } from "@/lib/supabase/error-format";
import { parseRpcBoolean } from "@/lib/supabase/rpc-boolean";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import { generateProvisionedAuthEmail } from "@/lib/creator-provisioning/claim-transfer";
import { generateOpaqueToken } from "@/lib/creator-provisioning/tokens";

function mapProfileUpsertFailure(err: unknown): { text: string; status: number } {
  const full = formatSupabaseErrorForDisplay(err);
  const m = flattenSupabaseError(err).message || "";
  if (
    /duplicate key|profiles_username_key|profiles_pkey|unique constraint|already exists/i.test(
      m + full,
    )
  ) {
    return {
      text:
        "That handle is already in use. Another profile may have claimed it during provisioning.\n\n" +
        full,
      status: 409,
    };
  }
  return { text: full || "Failed to save profile", status: 500 };
}

function normalizeHandle(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

/**
 * One RPC mirrors DB reality (trim+lower, full table visible, no ILIKE wildcards).
 */
async function isProvisionHandleAvailable(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  handle: string,
): Promise<{ available: boolean; error?: string }> {
  const { data, error } = await admin.rpc("is_profile_handle_available", {
    handle_input: handle,
    exclude_profile_id: null,
  });
  if (error) {
    console.error("[admin/creators POST] is_profile_handle_available", error);
    return {
      available: false,
      error: "Could not verify handle availability.\n\n" + formatSupabaseErrorForDisplay(error),
    };
  }
  const parsed = parseRpcBoolean(data);
  if (parsed === null) {
    console.error("[admin/creators POST] is_profile_handle_available unexpected payload", data);
    return {
      available: false,
      error: "Handle check failed (unexpected server response). Retry or check API logs.",
    };
  }
  return { available: parsed };
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const source = url.searchParams.get("source");
    const claimStatus = url.searchParams.get("claim_status");
    const payoutStatus = url.searchParams.get("payout_status");
    const query = url.searchParams.get("q")?.trim();

    const admin = createSupabaseAdminClient();
    let q = admin
      .from("profiles")
      .select(
        "id, handle, full_name, avatar_url, banner_url, email, source, claim_status, claimed_at, provisioned_at, provisioned_by_admin_id, created_at, can_receive_payments, stripe_onboarding_status",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (source === "admin_provisioned") {
      q = q.eq("source", "admin_provisioned");
    }
    if (claimStatus === "unclaimed" || claimStatus === "claimed") {
      q = q.eq("claim_status", claimStatus);
    }
    if (payoutStatus === "ready") {
      q = q.eq("can_receive_payments", true);
    } else if (payoutStatus === "pending") {
      q = q.neq("can_receive_payments", true);
    }
    if (query) {
      const escaped = query.replace(/[%_]/g, "\\$&");
      q = q.or(`handle.ilike.%${escaped}%,full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const creators = data ?? [];
    const creatorIds = creators.map((creator) => creator.id);
    const now = new Date().toISOString();
    const { data: activeOverrides } =
      creatorIds.length > 0
        ? await admin
            .from("creator_platform_fee_overrides")
            .select("creator_id, platform_fee_percentage, ends_at")
            .in("creator_id", creatorIds)
            .is("revoked_at", null)
            .lte("starts_at", now)
            .gt("ends_at", now)
        : {
            data: [] as Array<{
              creator_id: string;
              platform_fee_percentage: number;
              ends_at: string;
            }>,
          };

    const overrideByCreator = new Map(
      (activeOverrides ?? []).map((row) => [
        row.creator_id,
        {
          platform_fee_percentage: row.platform_fee_percentage,
          ends_at: row.ends_at,
        },
      ]),
    );

    return NextResponse.json({
      creators: creators.map((creator) => ({
        ...creator,
        active_fee_override: overrideByCreator.get(creator.id) ?? null,
      })),
    });
  } catch (e: any) {
    console.error("[admin/creators GET]", e);
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { handle, full_name, bio, avatar_url, banner_url, socials, country } = body as Record<
      string,
      unknown
    >;

    const email = generateProvisionedAuthEmail();
    const h = normalizeHandle(String(handle ?? ""));
    const name = String(full_name ?? "").trim();

    if (!h || !name) {
      return NextResponse.json({ error: "handle and full_name are required" }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,24}$/.test(h)) {
      return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { available, error: handleCheckErr } = await isProvisionHandleAvailable(admin, h);
    if (handleCheckErr) {
      return NextResponse.json({ error: handleCheckErr }, { status: 503 });
    }
    if (!available) {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }

    // Supabase hashes passwords with bcrypt (max 72 bytes); one 64-char hex token fits.
    const tempPassword = generateOpaqueToken();

    // Do not auto-confirm: confirmed inserts fire auth.users welcome-email triggers and edge calls
    // for synthetic @provisioned.* addresses; dormant users never sign in with this identity.
    let authUser: Awaited<ReturnType<typeof admin.auth.admin.createUser>>["data"];
    let createErr: Awaited<ReturnType<typeof admin.auth.admin.createUser>>["error"];
    try {
      // `edgaze_defer_profile_row` skips handle_new_user()'s INSERT; GoTrue often hides trigger failures
      // behind `unexpected_failure`. We create the profile row in the upsert below with the real handle.
      const created = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false,
        user_metadata: { full_name: name, edgaze_defer_profile_row: true },
        app_metadata: { edgaze_defer_profile_row: true },
      });
      authUser = created.data;
      createErr = created.error;
    } catch (e) {
      console.error("[admin/creators POST] createUser threw", e);
      return NextResponse.json({ error: formatSupabaseErrorForDisplay(e) }, { status: 502 });
    }

    if (createErr || !authUser?.user) {
      console.error("[admin/creators POST] createUser", createErr);
      return NextResponse.json(
        { error: formatSupabaseErrorForDisplay(createErr) },
        { status: 400 },
      );
    }

    const uid = authUser.user.id;

    const profilePayload = {
      id: uid,
      email,
      handle: h,
      full_name: name,
      bio: bio != null ? String(bio).slice(0, 1000) : null,
      avatar_url: avatar_url != null ? String(avatar_url).slice(0, 2000) : null,
      banner_url: banner_url != null ? String(banner_url).slice(0, 2000) : null,
      socials: socials && typeof socials === "object" ? socials : {},
      country: country != null ? String(country).toUpperCase().slice(0, 2) : null,
      plan: "Free",
      source: "admin_provisioned",
      claim_status: "unclaimed",
      provisioned_by_admin_id: user.id,
      provisioned_at: new Date().toISOString(),
    };

    // Plain upsert can still issue INSERT and hit profiles_pkey if a row already exists (e.g. trigger
    // ran, or PostgREST merge semantics). Insert-or-update explicitly avoids duplicate (id) errors.
    const { data: existingProfile, error: existingErr } = await admin
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();

    if (existingErr) {
      console.error("[admin/creators POST] profile existence check", existingErr);
      await admin.auth.admin.deleteUser(uid).catch((delErr) => {
        console.error(
          "[admin/creators POST] rollback deleteUser after profile check failure",
          delErr,
        );
      });
      return NextResponse.json(
        { error: formatSupabaseErrorForDisplay(existingErr) },
        { status: 500 },
      );
    }

    const saveRes = existingProfile
      ? await admin.from("profiles").update(profilePayload).eq("id", uid)
      : await admin.from("profiles").insert(profilePayload);

    if (saveRes.error) {
      console.error("[admin/creators POST] profile save", saveRes.error);
      await admin.auth.admin.deleteUser(uid).catch((delErr) => {
        console.error(
          "[admin/creators POST] rollback deleteUser after profile save failure",
          delErr,
        );
      });
      const mapped = mapProfileUpsertFailure(saveRes.error);
      return NextResponse.json({ error: mapped.text }, { status: mapped.status });
    }

    const { error: metaErr } = await admin.auth.admin.updateUserById(uid, {
      user_metadata: { full_name: name, handle: h, edgaze_defer_profile_row: false },
    });
    if (metaErr) {
      console.error("[admin/creators POST] updateUserById user_metadata", metaErr);
    }

    await logCreatorAuditEvent({
      action: "creator.profile.provisioned",
      actorUserId: user.id,
      actorRole: "super_admin",
      actorMode: "admin_direct",
      effectiveProfileId: uid,
      resourceType: "profile",
      resourceId: uid,
      metadata: { handle: h },
    });

    return NextResponse.json({
      profile: { id: uid, handle: h },
    });
  } catch (e: unknown) {
    console.error("[admin/creators POST]", e);
    const msg =
      e instanceof Error && e.message && e.message !== "Internal Server Error"
        ? e.message
        : "Something went wrong. Check server logs.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
