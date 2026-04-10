/**
 * Track a listing view (prompt or workflow). Server-authoritative; 30m viewer cooldown;
 * light bot / burst protection. Inserts listing_view_events for creator analytics.
 *
 * Anonymous viewers should send deviceFingerprint (or a stable client key); bare "unknown"
 * IP identifiers are not used so views still count in dev and on first visit.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_VIEWS_PER_CLIENT_PER_HOUR = 400;

function isSuspiciousUserAgent(req: Request): boolean {
  const ua = (req.headers.get("user-agent") ?? "").trim().toLowerCase();
  if (!ua) return false;
  return /\b(bot|crawler|spider|scrape|headless|facebookexternalhit|slackbot|discordbot)\b/i.test(
    ua,
  );
}

function resolveViewerKeys(params: {
  userId: string | null;
  bodyFingerprint?: string;
  req: Request;
}): { userId: string | null; dedupeKey: string | null; clientIdentifierForEvent: string | null } {
  const { userId, bodyFingerprint, req } = params;
  if (userId) {
    return { userId, dedupeKey: `user:${userId}`, clientIdentifierForEvent: null };
  }

  const fp =
    bodyFingerprint && typeof bodyFingerprint === "string" && bodyFingerprint.length >= 10
      ? `fp:${bodyFingerprint.trim()}`
      : null;

  const extracted = extractClientIdentifier(req);
  const fromHeaders =
    extracted.identifier && extracted.identifier !== "unknown" ? extracted.identifier : null;

  const dedupeKey = fp ?? (fromHeaders ? `net:${fromHeaders}` : null);
  const clientIdentifierForEvent = fp ?? fromHeaders;

  return { userId: null, dedupeKey, clientIdentifierForEvent };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      listingId?: string;
      listingType?: string;
      deviceFingerprint?: string;
    };
    const listingId = body?.listingId;
    const listingTypeRaw = body?.listingType ?? "prompt";
    const listingType = listingTypeRaw === "workflow" ? "workflow" : "prompt";

    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json({ error: "listingId is required" }, { status: 400 });
    }

    if (isSuspiciousUserAgent(req)) {
      return NextResponse.json({ ok: true, counted: false, reason: "bot_ua" });
    }

    const { user } = await getUserAndClient(req);
    const userId = user?.id ?? null;

    const { dedupeKey, clientIdentifierForEvent } = resolveViewerKeys({
      userId,
      bodyFingerprint: body.deviceFingerprint,
      req,
    });

    if (!dedupeKey) {
      return NextResponse.json({ ok: true, counted: false, reason: "no_identifier" });
    }

    const supabase = createSupabaseAdminClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (clientIdentifierForEvent) {
      const { count } = await supabase
        .from("listing_view_events")
        .select("id", { count: "exact", head: true })
        .eq("client_identifier", clientIdentifierForEvent)
        .gte("counted_at", hourAgo);
      if ((count ?? 0) > MAX_VIEWS_PER_CLIENT_PER_HOUR) {
        return NextResponse.json({ ok: true, counted: false, reason: "client_rate_limit" });
      }
    }

    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();

    let existing: { last_viewed_at: string } | null = null;
    if (userId) {
      const { data } = await supabase
        .from("listing_views")
        .select("last_viewed_at")
        .eq("listing_type", listingType)
        .eq("listing_id", listingId)
        .eq("user_id", userId)
        .maybeSingle();
      existing = data;
    } else if (clientIdentifierForEvent) {
      const { data } = await supabase
        .from("listing_views")
        .select("last_viewed_at")
        .eq("listing_type", listingType)
        .eq("listing_id", listingId)
        .eq("client_identifier", clientIdentifierForEvent)
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
        .eq("listing_type", listingType)
        .eq("listing_id", listingId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (!updated) {
        const { error: insErr } = await supabase.from("listing_views").insert({
          listing_type: listingType,
          listing_id: listingId,
          user_id: userId,
          client_identifier: null,
          last_viewed_at: now,
        });
        if (insErr) {
          console.error("[views/track] listing_views insert", insErr);
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
      }
    } else if (clientIdentifierForEvent) {
      const { data: updated } = await supabase
        .from("listing_views")
        .update({ last_viewed_at: now })
        .eq("listing_type", listingType)
        .eq("listing_id", listingId)
        .eq("client_identifier", clientIdentifierForEvent)
        .select("id")
        .maybeSingle();
      if (!updated) {
        const { error: insErr } = await supabase.from("listing_views").insert({
          listing_type: listingType,
          listing_id: listingId,
          user_id: null,
          client_identifier: clientIdentifierForEvent,
          last_viewed_at: now,
        });
        if (insErr) {
          console.error("[views/track] listing_views insert (anon)", insErr);
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
      }
    }

    const { error: evErr } = await supabase.from("listing_view_events").insert({
      listing_type: listingType,
      listing_id: listingId,
      viewer_user_id: userId,
      client_identifier: clientIdentifierForEvent,
      counted_at: now,
    });
    if (evErr) {
      console.error("[views/track] listing_view_events insert", evErr);
      return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 });
    }

    if (listingType === "workflow") {
      const { data: row } = await supabase
        .from("workflows")
        .select("views_count")
        .eq("id", listingId)
        .maybeSingle();
      const cur = (row as { views_count?: number } | null)?.views_count ?? 0;
      await supabase
        .from("workflows")
        .update({ views_count: Number(cur) + 1 })
        .eq("id", listingId);
    } else {
      const { data: row } = await supabase
        .from("prompts")
        .select("view_count, views_count")
        .eq("id", listingId)
        .maybeSingle();
      const r = row as { view_count?: number | null; views_count?: number | null } | null;
      const vc = Number(r?.view_count ?? 0);
      const vsc = Number(r?.views_count ?? 0);
      await supabase
        .from("prompts")
        .update({
          view_count: vc + 1,
          views_count: vsc + 1,
        })
        .eq("id", listingId);
    }

    return NextResponse.json({ ok: true, counted: true });
  } catch (e: unknown) {
    console.error("[views/track] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 },
    );
  }
}
