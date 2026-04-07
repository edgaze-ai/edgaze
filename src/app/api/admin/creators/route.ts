import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { isAdmin } from "@/lib/supabase/executions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCreatorAuditEvent } from "@/lib/creator-provisioning/audit";
import { generateProvisionedAuthEmail } from "@/lib/creator-provisioning/claim-transfer";
import { generateOpaqueToken } from "@/lib/creator-provisioning/tokens";

function supabaseAuthErrMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Failed to create auth user";
  }
  const o = err as Record<string, unknown>;
  const msg = typeof o.message === "string" ? o.message.trim() : "";
  const code = typeof o.code === "string" ? o.code : "";
  if (msg && msg !== "Internal Server Error") {
    return msg;
  }
  if (code) {
    return `Auth error (${code}). Check Supabase Auth logs; if this persists, try again later.`;
  }
  return "Auth service returned an error. Check Supabase project health and Auth logs.";
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

    const admin = createSupabaseAdminClient();
    let q = admin
      .from("profiles")
      .select(
        "id, handle, full_name, avatar_url, banner_url, email, source, claim_status, claimed_at, provisioned_at, provisioned_by_admin_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (source === "admin_provisioned") {
      q = q.eq("source", "admin_provisioned");
    }
    if (claimStatus === "unclaimed" || claimStatus === "claimed") {
      q = q.eq("claim_status", claimStatus);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ creators: data ?? [] });
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

    const { data: clash } = await admin.from("profiles").select("id").eq("handle", h).maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }

    const tempPassword = `${generateOpaqueToken()}${generateOpaqueToken()}`;

    // Do not auto-confirm: confirmed inserts fire auth.users welcome-email triggers and edge calls
    // for synthetic @provisioned.* addresses; dormant users never sign in with this identity.
    let authUser: Awaited<ReturnType<typeof admin.auth.admin.createUser>>["data"];
    let createErr: Awaited<ReturnType<typeof admin.auth.admin.createUser>>["error"];
    try {
      const created = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false,
        user_metadata: { full_name: name, handle: h },
      });
      authUser = created.data;
      createErr = created.error;
    } catch (e) {
      console.error("[admin/creators POST] createUser threw", e);
      return NextResponse.json({ error: supabaseAuthErrMessage(e) }, { status: 502 });
    }

    if (createErr || !authUser?.user) {
      console.error("[admin/creators POST] createUser", createErr);
      return NextResponse.json({ error: supabaseAuthErrMessage(createErr) }, { status: 400 });
    }

    const uid = authUser.user.id;

    const { error: upsertErr } = await admin.from("profiles").upsert(
      {
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
      },
      { onConflict: "id" },
    );

    if (upsertErr) {
      console.error("[admin/creators POST] profile upsert", upsertErr);
      await admin.auth.admin.deleteUser(uid).catch((delErr) => {
        console.error("[admin/creators POST] rollback deleteUser after upsert failure", delErr);
      });
      return NextResponse.json(
        { error: upsertErr.message || "Failed to save profile" },
        { status: 500 },
      );
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
