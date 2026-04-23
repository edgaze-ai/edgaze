import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  affiliate_link_id: string;
  event_type: "page_view" | "cta_click";
  viewer_user_id: string | null;
  client_identifier: string | null;
  page_url: string | null;
  referrer: string | null;
  target_url: string | null;
  occurred_at: string;
};

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function roundPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function visitorKey(row: EventRow): string | null {
  return row.viewer_user_id ? `user:${row.viewer_user_id}` : row.client_identifier;
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const daysRaw = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(180, Math.floor(daysRaw))) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const admin = createSupabaseAdminClient();
    const { data: links, error: linksError } = await admin
      .from("affiliate_links")
      .select(
        "id, slug, label, owner_profile_handle, storefront_path, cta_url, is_active, created_at",
      )
      .order("created_at", { ascending: false });

    if (linksError) {
      console.error("[admin/affiliate-links] links", linksError);
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    const linkIds = (links ?? []).map((link) => String((link as { id: string }).id));
    let events: EventRow[] = [];
    if (linkIds.length > 0) {
      const { data, error } = await admin
        .from("affiliate_link_events")
        .select(
          "id, affiliate_link_id, event_type, viewer_user_id, client_identifier, page_url, referrer, target_url, occurred_at",
        )
        .in("affiliate_link_id", linkIds)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(10000);

      if (error) {
        console.error("[admin/affiliate-links] events", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      events = (data ?? []) as EventRow[];
    }

    const eventsByLink = new Map<string, EventRow[]>();
    for (const event of events) {
      const list = eventsByLink.get(event.affiliate_link_id) ?? [];
      list.push(event);
      eventsByLink.set(event.affiliate_link_id, list);
    }

    const rows = (links ?? []).map((raw) => {
      const link = raw as Record<string, unknown>;
      const linkEvents = eventsByLink.get(String(link.id)) ?? [];
      const views = linkEvents.filter((event) => event.event_type === "page_view").length;
      const ctaClicks = linkEvents.filter((event) => event.event_type === "cta_click").length;
      const uniqueVisitors = new Set(
        linkEvents
          .filter((event) => event.event_type === "page_view")
          .map(visitorKey)
          .filter(Boolean),
      ).size;

      const dailyMap = new Map<string, { date: string; views: number; ctaClicks: number }>();
      for (const event of linkEvents) {
        const key = dayKey(event.occurred_at);
        const bucket = dailyMap.get(key) ?? { date: key, views: 0, ctaClicks: 0 };
        if (event.event_type === "page_view") bucket.views += 1;
        if (event.event_type === "cta_click") bucket.ctaClicks += 1;
        dailyMap.set(key, bucket);
      }

      return {
        id: String(link.id),
        slug: String(link.slug ?? ""),
        label: String(link.label ?? ""),
        ownerProfileHandle: (link.owner_profile_handle as string | null) ?? null,
        storefrontPath: String(link.storefront_path ?? ""),
        ctaUrl: String(link.cta_url ?? ""),
        isActive: Boolean(link.is_active),
        views,
        uniqueVisitors,
        ctaClicks,
        conversionRatePct: roundPct(ctaClicks, views),
        daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    return NextResponse.json({
      days,
      rows,
      recentEvents: events.slice(0, 250).map((event) => ({
        id: event.id,
        affiliateLinkId: event.affiliate_link_id,
        eventType: event.event_type,
        occurredAt: event.occurred_at,
        pageUrl: event.page_url,
        referrer: event.referrer,
        targetUrl: event.target_url,
        visitor: visitorKey(event),
      })),
    });
  } catch (error: unknown) {
    console.error("[admin/affiliate-links]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
