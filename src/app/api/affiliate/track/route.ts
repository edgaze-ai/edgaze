import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { extractClientIdentifier } from "@lib/rate-limiting/image-generation";

export const dynamic = "force-dynamic";

type AffiliateEventType = "page_view" | "cta_click";

function normalizeEventType(value: unknown): AffiliateEventType | null {
  return value === "page_view" || value === "cta_click" ? value : null;
}

function clampText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function resolveClientIdentifier(req: Request, fingerprint: unknown): string | null {
  const fp = clampText(fingerprint, 160);
  if (fp && fp.length >= 10) return `fp:${fp}`;

  const extracted = extractClientIdentifier(req);
  if (extracted.identifier && extracted.identifier !== "unknown") {
    return `net:${extracted.identifier}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const slug = clampText(body.slug, 80)?.toLowerCase();
    const eventType = normalizeEventType(body.eventType);

    if (!slug || !eventType) {
      return NextResponse.json({ error: "slug and eventType are required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: link, error: linkError } = await admin
      .from("affiliate_links")
      .select("id, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (linkError) {
      console.error("[affiliate/track] link lookup", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    if (!link || link.is_active === false) {
      return NextResponse.json({ error: "Affiliate link not found" }, { status: 404 });
    }

    const { user } = await getUserAndClient(req);
    const clientIdentifier = resolveClientIdentifier(req, body.deviceFingerprint);

    const { error: insertError } = await admin.from("affiliate_link_events").insert({
      affiliate_link_id: link.id,
      event_type: eventType,
      viewer_user_id: user?.id ?? null,
      client_identifier: clientIdentifier,
      page_url: clampText(body.pageUrl, 500),
      referrer: clampText(body.referrer, 500),
      target_url: clampText(body.targetUrl, 500),
      user_agent: clampText(req.headers.get("user-agent"), 500),
    });

    if (insertError) {
      console.error("[affiliate/track] insert", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[affiliate/track]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
