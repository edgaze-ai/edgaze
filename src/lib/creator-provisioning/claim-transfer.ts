import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TransferResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Domain for synthetic auth emails (dormant provisioned users). Must be unique per user;
 * avoid long local-parts: many DB triggers fall back to email local-part as profiles.handle,
 * which is limited to 24 characters in this app.
 */
function provisionedEmailDomain(): string {
  const explicit = process.env.PROVISIONED_CREATOR_EMAIL_DOMAIN?.trim();
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) {
    try {
      const { hostname } = new URL(app);
      if (hostname && hostname !== "localhost" && !hostname.startsWith("127.")) {
        return `provisioned.${hostname}`;
      }
    } catch {
      /* ignore */
    }
  }
  return "edgaze-provisioned.invalid";
}

/** Local-part is exactly 24 chars [a-z0-9] so it never exceeds profiles.handle max length. */
export function generateProvisionedAuthEmail(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const local = `p${hex.slice(0, 23)}`;
  return `${local}@${provisionedEmailDomain()}`;
}

/**
 * Move an admin-provisioned workspace from dormant user `oldProfileId` to claimant `newUserId`.
 * Deletes the dormant profile + auth user after moving ownership.
 */
export async function transferProvisionedWorkspaceToClaimant(args: {
  admin: SupabaseClient;
  oldProfileId: string;
  newUserId: string;
  claimerEmail: string;
}): Promise<TransferResult> {
  const { admin, oldProfileId, newUserId, claimerEmail } = args;

  if (!UUID_RE.test(oldProfileId) || !UUID_RE.test(newUserId)) {
    return { ok: false, error: "Invalid id", status: 400 };
  }

  if (oldProfileId === newUserId) {
    return { ok: true };
  }

  const { data: provRow, error: provErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", oldProfileId)
    .maybeSingle();

  if (provErr) {
    return { ok: false, error: "Provisioned profile not found", status: 404 };
  }

  if (!provRow) {
    const { data: claimantProf } = await admin
      .from("profiles")
      .select("claim_status, source")
      .eq("id", newUserId)
      .maybeSingle();
    const cp = claimantProf as { claim_status?: string; source?: string } | null;
    if (cp?.claim_status === "claimed" && cp?.source === "self_signup") {
      return { ok: true };
    }
    return { ok: false, error: "Provisioned profile not found", status: 404 };
  }

  const prov = provRow as Record<string, unknown>;
  if (prov.source !== "admin_provisioned") {
    return { ok: false, error: "Not an admin-provisioned workspace", status: 400 };
  }
  if (prov.claim_status !== "unclaimed") {
    return { ok: false, error: "Workspace already claimed", status: 409 };
  }

  const { count: wfCount, error: wfCountErr } = await admin
    .from("workflows")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", newUserId);

  if (wfCountErr) {
    console.error("[claim-transfer] workflow count", wfCountErr);
    return { ok: false, error: "Could not verify claimant account", status: 500 };
  }

  const { count: prCount, error: prCountErr } = await admin
    .from("prompts")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", newUserId);

  if (prCountErr) {
    console.error("[claim-transfer] prompts count", prCountErr);
    return { ok: false, error: "Could not verify claimant account", status: 500 };
  }

  if ((wfCount ?? 0) > 0 || (prCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This account already has creator content. Use a different Google or email account to claim this workspace.",
      status: 409,
    };
  }

  const now = new Date().toISOString();
  const ownerHandle = String(prov.handle ?? "");
  const ownerName = String(prov.full_name ?? ownerHandle ?? "");

  const { error: wfUp } = await admin
    .from("workflows")
    .update({
      owner_id: newUserId,
      user_id: newUserId,
      owner_handle: ownerHandle,
      owner_name: ownerName,
      updated_at: now,
    })
    .eq("owner_id", oldProfileId);

  if (wfUp) {
    console.error("[claim-transfer] workflows", wfUp);
    return { ok: false, error: wfUp.message, status: 500 };
  }

  const { error: draftUp } = await admin
    .from("workflow_drafts")
    .update({ owner_id: newUserId, updated_at: now })
    .eq("owner_id", oldProfileId);

  if (draftUp) {
    console.error("[claim-transfer] workflow_drafts", draftUp);
    return { ok: false, error: draftUp.message, status: 500 };
  }

  const { error: promptUp } = await admin
    .from("prompts")
    .update({
      owner_id: newUserId,
      owner_handle: ownerHandle,
      owner_name: ownerName,
      updated_at: now,
    })
    .eq("owner_id", oldProfileId);

  if (promptUp) {
    console.error("[claim-transfer] prompts", promptUp);
    return { ok: false, error: promptUp.message, status: 500 };
  }

  const { data: stripeC } = await admin
    .from("stripe_connect_accounts")
    .select("user_id")
    .eq("user_id", newUserId)
    .maybeSingle();

  if (stripeC) {
    return {
      ok: false,
      error: "This account already has payout settings. Use a different account to claim.",
      status: 409,
    };
  }

  const { error: stripeUp } = await admin
    .from("stripe_connect_accounts")
    .update({ user_id: newUserId })
    .eq("user_id", oldProfileId);

  if (stripeUp) {
    console.error("[claim-transfer] stripe_connect_accounts", stripeUp);
    return { ok: false, error: stripeUp.message, status: 500 };
  }

  for (const col of ["follower_id", "following_id"] as const) {
    const { error: fErr } = await admin
      .from("follows")
      .update({ [col]: newUserId })
      .eq(col, oldProfileId);
    if (fErr) {
      console.error("[claim-transfer] follows", col, fErr);
      return { ok: false, error: fErr.message, status: 500 };
    }
  }

  await admin.from("creator_onboarding").delete().eq("user_id", newUserId);

  const { error: runUp } = await admin
    .from("workflow_runs")
    .update({ user_id: newUserId })
    .eq("user_id", oldProfileId);

  if (runUp) {
    console.error("[claim-transfer] workflow_runs", runUp);
    return { ok: false, error: runUp.message, status: 500 };
  }

  const { error: runsUp } = await admin
    .from("runs")
    .update({ creator_user_id: newUserId })
    .eq("creator_user_id", oldProfileId);

  if (runsUp) {
    console.error("[claim-transfer] runs creator", runsUp);
    return { ok: false, error: runsUp.message, status: 500 };
  }

  const { error: runsRunner } = await admin
    .from("runs")
    .update({ runner_user_id: newUserId })
    .eq("runner_user_id", oldProfileId);

  if (runsRunner) {
    console.error("[claim-transfer] runs runner", runsRunner);
    return { ok: false, error: runsRunner.message, status: 500 };
  }

  const releaseHandle = ("rel" + oldProfileId.replace(/-/g, "") + Date.now().toString(36))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 24);

  const { error: releaseErr } = await admin
    .from("profiles")
    .update({ handle: releaseHandle, updated_at: now })
    .eq("id", oldProfileId);

  if (releaseErr) {
    console.error("[claim-transfer] release provisioned handle", releaseErr);
    return { ok: false, error: releaseErr.message, status: 500 };
  }

  const skipInsert = new Set(["id"]);
  const insertRow: Record<string, unknown> = { id: newUserId };
  for (const [k, v] of Object.entries(prov)) {
    if (skipInsert.has(k)) continue;
    insertRow[k] = v;
  }
  insertRow.email = claimerEmail.trim().toLowerCase();
  insertRow.claim_status = "claimed";
  insertRow.claimed_at = now;
  insertRow.source = "self_signup";
  insertRow.updated_at = now;

  // Upsert: claimant has a stub from handle_new_user; DELETE+INSERT could duplicate PK under races.
  const { error: profErr } = await admin.from("profiles").upsert(insertRow as any, {
    onConflict: "id",
  });

  if (profErr) {
    console.error("[claim-transfer] upsert claimant profile", profErr);
    return { ok: false, error: profErr.message, status: 500 };
  }

  await admin
    .from("creator_claim_links")
    .update({ profile_id: newUserId })
    .eq("profile_id", oldProfileId);

  await admin
    .from("admin_impersonation_sessions")
    .update({ target_profile_id: newUserId })
    .eq("target_profile_id", oldProfileId);

  await admin
    .from("creator_audit_events")
    .update({ effective_profile_id: newUserId })
    .eq("effective_profile_id", oldProfileId);

  const { error: delOld } = await admin.from("profiles").delete().eq("id", oldProfileId);
  if (delOld) {
    console.error("[claim-transfer] delete old profile", delOld);
    return { ok: false, error: delOld.message, status: 500 };
  }

  const { error: delAuth } = await admin.auth.admin.deleteUser(oldProfileId);
  if (delAuth) {
    console.error("[claim-transfer] delete dormant auth user", delAuth);
    return {
      ok: false,
      error: "Workspace transferred but removing the provisioned login failed. Contact support.",
      status: 500,
    };
  }

  return { ok: true };
}
