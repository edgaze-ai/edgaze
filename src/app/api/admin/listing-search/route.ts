// Admin-only: search workflows or prompts by title, Edgaze code, or owner handle.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") || "").trim();
    if (kind !== "workflow" && kind !== "prompt") {
      return NextResponse.json({ error: "kind must be workflow or prompt" }, { status: 400 });
    }

    const qRaw = (url.searchParams.get("q") || "").trim();
    if (qRaw.length < 1) {
      return NextResponse.json({ listings: [] });
    }
    const q = qRaw.slice(0, 120);
    const supabase = createSupabaseAdminClient();

    const cols = "id, title, edgaze_code, owner_handle, owner_name, is_published";

    const table = kind === "workflow" ? "workflows" : "prompts";

    if (UUID_RE.test(q)) {
      const { data, error } = await supabase.from(table).select(cols).eq("id", q).maybeSingle();
      if (error) {
        console.error("[admin/listing-search]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (data) {
        return NextResponse.json({
          listings: [normalizeListing(kind, data as Record<string, unknown>)],
        });
      }
    }

    const escaped = escapeLikePattern(q);
    const pattern = `%${escaped}%`;

    const [tRes, cRes, oRes] = await Promise.all([
      supabase.from(table).select(cols).ilike("title", pattern).limit(12),
      supabase.from(table).select(cols).ilike("edgaze_code", pattern).limit(12),
      supabase.from(table).select(cols).ilike("owner_handle", pattern).limit(12),
    ]);

    const err = tRes.error || cRes.error || oRes.error;
    if (err) {
      console.error("[admin/listing-search]", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const map = new Map<string, Record<string, unknown>>();
    for (const row of [...(tRes.data ?? []), ...(cRes.data ?? []), ...(oRes.data ?? [])]) {
      const id = String((row as { id: string }).id);
      if (!map.has(id)) map.set(id, row as Record<string, unknown>);
    }

    const listings = [...map.values()].slice(0, 25).map((r) => normalizeListing(kind, r));

    return NextResponse.json({ listings });
  } catch (err: unknown) {
    console.error("[admin/listing-search]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

function normalizeListing(kind: "workflow" | "prompt", r: Record<string, unknown>) {
  return {
    kind,
    id: String(r.id),
    title: (r.title as string | null) ?? null,
    edgaze_code: (r.edgaze_code as string | null) ?? null,
    owner_handle: (r.owner_handle as string | null) ?? null,
    owner_name: (r.owner_name as string | null) ?? null,
    is_published: Boolean(r.is_published),
  };
}
