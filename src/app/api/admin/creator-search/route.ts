// Admin-only: search profiles by handle, name, email, or exact user id.

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

    const qRaw = (new URL(req.url).searchParams.get("q") || "").trim();
    if (qRaw.length < 1) {
      return NextResponse.json({ creators: [] });
    }
    const q = qRaw.slice(0, 120);
    const supabase = createSupabaseAdminClient();

    if (UUID_RE.test(q)) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, handle, full_name, email")
        .eq("id", q)
        .maybeSingle();
      if (error) {
        console.error("[admin/creator-search]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (data) {
        return NextResponse.json({
          creators: [
            {
              id: (data as { id: string }).id,
              handle: (data as { handle?: string | null }).handle ?? null,
              full_name: (data as { full_name?: string | null }).full_name ?? null,
              email: (data as { email?: string | null }).email ?? null,
            },
          ],
        });
      }
    }

    const escaped = escapeLikePattern(q);
    const pattern = `%${escaped}%`;
    const cols = "id, handle, full_name, email";

    const [hRes, nRes, eRes] = await Promise.all([
      supabase.from("profiles").select(cols).ilike("handle", pattern).limit(12),
      supabase.from("profiles").select(cols).ilike("full_name", pattern).limit(12),
      supabase.from("profiles").select(cols).ilike("email", pattern).limit(12),
    ]);

    const err = hRes.error || nRes.error || eRes.error;
    if (err) {
      console.error("[admin/creator-search]", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const map = new Map<string, Record<string, unknown>>();
    for (const row of [...(hRes.data ?? []), ...(nRes.data ?? []), ...(eRes.data ?? [])]) {
      const id = String((row as { id: string }).id);
      if (!map.has(id)) map.set(id, row as Record<string, unknown>);
    }

    const creators = [...map.values()].slice(0, 25).map((r) => ({
      id: String(r.id),
      handle: (r.handle as string | null) ?? null,
      full_name: (r.full_name as string | null) ?? null,
      email: (r.email as string | null) ?? null,
    }));

    return NextResponse.json({ creators });
  } catch (err: unknown) {
    console.error("[admin/creator-search]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
