// src/app/api/admin/demo/route.ts
// Admin-only: list/search marketplace products and toggle demo mode.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { randomBytes } from "crypto";

function generateDemoToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));

    const supabase = createSupabaseAdminClient();

    const searchFilter = q
      ? `title.ilike.%${q}%,description.ilike.%${q}%,tags.ilike.%${q}%,owner_handle.ilike.%${q}%,edgaze_code.ilike.%${q}%`
      : undefined;

    const [promptsRes, workflowsRes] = await Promise.all([
      (() => {
        let query = supabase
          .from("prompts")
          .select("id, owner_handle, edgaze_code, title, type, visibility, demo_mode_enabled, demo_token, removed_at, updated_at")
          .in("visibility", ["public", "unlisted"])
          .in("type", ["prompt", "workflow"])
          .is("removed_at", null)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (searchFilter) query = query.or(searchFilter);
        return query;
      })(),
      (() => {
        let query = supabase
          .from("workflows")
          .select("id, owner_handle, edgaze_code, title, visibility, demo_mode_enabled, demo_token, removed_at, updated_at")
          .eq("is_published", true)
          .is("removed_at", null)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (searchFilter) query = query.or(searchFilter);
        return query;
      })(),
    ]);

    const prompts = (promptsRes.data ?? []).map((p: any) => ({
      ...p,
      type: "prompt",
      path: `/p/${p.owner_handle}/${p.edgaze_code}`,
    }));

    const workflows = (workflowsRes.data ?? []).map((w: any) => ({
      ...w,
      type: "workflow",
      path: `/${w.owner_handle}/${w.edgaze_code}`,
    }));

    const merged = [...prompts, ...workflows].sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );

    return NextResponse.json({ products: merged });
  } catch (err: unknown) {
    console.error("Admin demo list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const { target_type, target_id, enabled } = body;

    if (!target_type || !["prompt", "workflow"].includes(target_type)) {
      return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
    }
    if (!target_id || typeof target_id !== "string") {
      return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const table = target_type === "prompt" ? "prompts" : "workflows";

    const update: Record<string, unknown> = {
      demo_mode_enabled: enabled,
      ...(enabled ? { demo_token: generateDemoToken() } : { demo_token: null }),
    };

    const { data, error } = await supabase
      .from(table)
      .update(update)
      .eq("id", target_id)
      .select("demo_mode_enabled, demo_token, owner_handle, edgaze_code")
      .single();

    if (error) {
      console.error("Admin demo toggle error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const base = process.env.NEXT_PUBLIC_APP_URL || "https://edgaze.ai";
    const path = target_type === "prompt" ? `/p/${data.owner_handle}/${data.edgaze_code}` : `/${data.owner_handle}/${data.edgaze_code}`;
    const demoUrl = data.demo_token ? `${base}${path}?demo=${encodeURIComponent(data.demo_token)}` : null;

    return NextResponse.json({
      ok: true,
      demo_mode_enabled: data.demo_mode_enabled,
      demo_token: data.demo_token,
      demo_url: demoUrl,
    });
  } catch (err: unknown) {
    console.error("Admin demo toggle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
