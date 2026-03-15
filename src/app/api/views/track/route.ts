/**
 * Track a listing view. Counts once per user per listing per 6 hours.
 */
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

const COOLDOWN_HOURS = 6;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { listingId?: string };
    const listingId = body?.listingId;

    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json({ error: "listingId is required" }, { status: 400 });
    }

    const { user } = await getUserFromRequest(req);
    const clientId = extractClientIdentifier(req);
    const userId = user?.id ?? null;
    const clientIdentifier = !userId && clientId.identifier ? clientId.identifier : null;

    if (!userId && !clientIdentifier) {
      return NextResponse.json({ ok: true, counted: false, reason: "no_identifier" });
    }

    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

    let existing: { last_viewed_at: string } | null = null;
    if (userId) {
      const { data } = await supabase
        .from("listing_views")
        .select("last_viewed_at")
        .eq("listing_id", listingId)
        .eq("user_id", userId)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from("listing_views")
        .select("last_viewed_at")
        .eq("listing_id", listingId)
        .eq("client_identifier", clientIdentifier)
        .maybeSingle();
      existing = data;
    }

    if (existing && existing.last_viewed_at >= since) {
      return NextResponse.json({ ok: true, counted: false, reason: "cooldown" });
    }

    const now = new Date().toISOString();
    if (userId) {
      const { data: updated } = await supabase
        .from("listing_views")
        .update({ last_viewed_at: now })
        .eq("listing_id", listingId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (!updated) {
        await supabase.from("listing_views").insert({
          listing_id: listingId,
          user_id: userId,
          client_identifier: null,
          last_viewed_at: now,
        });
      }
    } else {
      const { data: updated } = await supabase
        .from("listing_views")
        .update({ last_viewed_at: now })
        .eq("listing_id", listingId)
        .eq("client_identifier", clientIdentifier)
        .select("id")
        .maybeSingle();
      if (!updated) {
        await supabase.from("listing_views").insert({
          listing_id: listingId,
          user_id: null,
          client_identifier: clientIdentifier,
          last_viewed_at: now,
        });
      }
    }

    const { data: prompt } = await supabase
      .from("prompts")
      .select("view_count")
      .eq("id", listingId)
      .single();

    const currentCount = (prompt as { view_count?: number } | null)?.view_count ?? 0;
    await supabase
      .from("prompts")
      .update({ view_count: currentCount + 1 })
      .eq("id", listingId);

    return NextResponse.json({ ok: true, counted: true });
  } catch (e: unknown) {
    console.error("[views/track] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 },
    );
  }
}
