import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export const dynamic = "force-dynamic";

function isNaturallyFree(row: { is_paid?: boolean | null; monetisation_mode?: string | null }) {
  return row.monetisation_mode === "free" || row.is_paid === false;
}

/** Full prompt_text + placeholders for entitled signed-in users (owner / purchase / free). */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const promptId = u.searchParams.get("prompt_id")?.trim();
    if (!promptId) {
      return NextResponse.json({ error: "prompt_id required" }, { status: 400 });
    }

    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from("prompts")
      .select("id, owner_id, prompt_text, placeholders, is_paid, monetisation_mode, removed_at")
      .eq("id", promptId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ((row as { removed_at?: string | null }).removed_at != null) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const r = row as {
      owner_id?: string | null;
      prompt_text?: string | null;
      placeholders?: unknown;
      is_paid?: boolean | null;
      monetisation_mode?: string | null;
    };

    if (isNaturallyFree(r)) {
      return NextResponse.json({
        prompt_text: r.prompt_text ?? null,
        placeholders: r.placeholders ?? null,
      });
    }

    if (String(r.owner_id ?? "") === String(user.id)) {
      return NextResponse.json({
        prompt_text: r.prompt_text ?? null,
        placeholders: r.placeholders ?? null,
      });
    }

    const { data: purchase } = await supabase
      .from("prompt_purchases")
      .select("id")
      .eq("prompt_id", promptId)
      .eq("buyer_id", user.id)
      .eq("status", "paid")
      .is("refunded_at", null)
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json({ error: "Purchase required." }, { status: 403 });
    }

    return NextResponse.json({
      prompt_text: r.prompt_text ?? null,
      placeholders: r.placeholders ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[prompt/resolve-content]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
