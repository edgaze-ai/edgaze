// Admin-only: move a workflow (workflows) or prompt listing (prompts) to another user.
// Updates owner_id / owner_handle / owner_name and workflow_drafts.owner_id when the draft id matches the workflow id.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { target_type, target_id, new_owner_id } = body as {
      target_type?: string;
      target_id?: string;
      new_owner_id?: string;
    };

    if (!target_type || !["prompt", "workflow"].includes(target_type)) {
      return NextResponse.json(
        { error: "Invalid target_type (use prompt or workflow)" },
        { status: 400 },
      );
    }
    if (!target_id || typeof target_id !== "string" || !UUID_RE.test(target_id)) {
      return NextResponse.json({ error: "Invalid target_id (UUID required)" }, { status: 400 });
    }
    if (!new_owner_id || typeof new_owner_id !== "string" || !UUID_RE.test(new_owner_id)) {
      return NextResponse.json({ error: "Invalid new_owner_id (UUID required)" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: newProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, handle, full_name")
      .eq("id", new_owner_id)
      .maybeSingle();

    if (profileErr || !newProfile) {
      return NextResponse.json({ error: "New owner profile not found" }, { status: 404 });
    }

    const newHandle = (newProfile as { handle?: string | null }).handle?.trim();
    if (!newHandle) {
      return NextResponse.json(
        { error: "New owner must have a profile handle before receiving a listing" },
        { status: 400 },
      );
    }

    const newName = (newProfile as { full_name?: string | null }).full_name?.trim() || "";

    if (target_type === "workflow") {
      const { data: row, error: wfErr } = await supabase
        .from("workflows")
        .select("id, owner_id, edgaze_code")
        .eq("id", target_id)
        .maybeSingle();

      if (wfErr || !row) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }

      const wf = row as { id: string; owner_id: string; edgaze_code: string | null };

      if (String(wf.owner_id) === String(new_owner_id)) {
        return NextResponse.json(
          { error: "Listing is already owned by that user" },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("workflows")
        .update({
          owner_id: new_owner_id,
          user_id: new_owner_id,
          owner_handle: newHandle,
          owner_name: newName,
          updated_at: now,
        })
        .eq("id", target_id);

      if (upErr) {
        console.error("[transfer-listing-ownership] workflows update:", upErr);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      await supabase
        .from("workflow_drafts")
        .update({ owner_id: new_owner_id, updated_at: now })
        .eq("id", target_id);

      const code = wf.edgaze_code?.trim() || "";
      return NextResponse.json({
        ok: true,
        target_type: "workflow",
        id: target_id,
        edgaze_code: code,
        new_owner_id,
        new_owner_handle: newHandle,
        canonical_path: code
          ? `/${encodeURIComponent(newHandle)}/${encodeURIComponent(code)}`
          : null,
      });
    }

    // prompts table (Prompt Studio listings; owner_id is text)
    const { data: prow, error: pErr } = await supabase
      .from("prompts")
      .select("id, owner_id, edgaze_code")
      .eq("id", target_id)
      .maybeSingle();

    if (pErr || !prow) {
      return NextResponse.json({ error: "Prompt listing not found" }, { status: 404 });
    }

    const pr = prow as { id: string; owner_id: string | null; edgaze_code: string | null };

    if (String(pr.owner_id) === String(new_owner_id)) {
      return NextResponse.json({ error: "Listing is already owned by that user" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: pUpErr } = await supabase
      .from("prompts")
      .update({
        owner_id: new_owner_id,
        owner_handle: newHandle,
        owner_name: newName,
        updated_at: now,
      })
      .eq("id", target_id);

    if (pUpErr) {
      console.error("[transfer-listing-ownership] prompts update:", pUpErr);
      return NextResponse.json({ error: pUpErr.message }, { status: 500 });
    }

    const code = pr.edgaze_code?.trim() || "";
    return NextResponse.json({
      ok: true,
      target_type: "prompt",
      id: target_id,
      edgaze_code: code,
      new_owner_id,
      new_owner_handle: newHandle,
      canonical_path: code
        ? `/p/${encodeURIComponent(newHandle)}/${encodeURIComponent(code)}`
        : null,
    });
  } catch (err: unknown) {
    console.error("[transfer-listing-ownership]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
