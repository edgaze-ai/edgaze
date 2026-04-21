import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { resolveActorContext } from "@lib/auth/actor-context";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { isMarketplaceUnifiedRunMetadata } from "@lib/metrics/publicRunCount";

export const dynamic = "force-dynamic";

type ListingKind = "prompt" | "workflow";

function periodToDays(period: string): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    out.push(dayKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { user } = await getUserAndClient(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveActorContext(req, user);
  const creatorId = actor.effectiveProfileId;

  const u = req.nextUrl.searchParams;
  const listingId = u.get("listingId")?.trim();
  const listingTypeRaw = u.get("listingType")?.trim() as ListingKind | null;
  const period = u.get("period")?.trim() ?? "30d";

  if (!listingId || !listingTypeRaw) {
    return NextResponse.json({ error: "listingId and listingType required" }, { status: 400 });
  }

  const listingType: ListingKind = listingTypeRaw === "workflow" ? "workflow" : "prompt";
  const days = periodToDays(period);
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();

  const admin = createSupabaseAdminClient();
  const table = listingType === "workflow" ? "workflows" : "prompts";

  const listingSelect =
    listingType === "workflow"
      ? "owner_id, title, description, thumbnail_url, edgaze_code, monetisation_mode, is_paid, price_usd, likes_count"
      : "owner_id, title, description, thumbnail_url, edgaze_code, monetisation_mode, is_paid, price_usd, likes_count";

  const { data: listingRow, error: ownerErr } = await admin
    .from(table)
    .select(listingSelect)
    .eq("id", listingId)
    .maybeSingle();

  if (ownerErr || !listingRow) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const ownerId = (listingRow as { owner_id?: string }).owner_id;
  if (String(ownerId ?? "") !== String(creatorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lr = listingRow as Record<string, unknown>;
  const likesTotal = Number(lr.likes_count ?? 0) || 0;

  const listing = {
    id: listingId,
    type: listingType,
    title: (lr.title as string) ?? null,
    description: (lr.description as string) ?? null,
    thumbnail_url: (lr.thumbnail_url as string) ?? null,
    edgaze_code: (lr.edgaze_code as string) ?? null,
    monetisation_mode: (lr.monetisation_mode as string) ?? null,
    is_paid: (lr.is_paid as boolean | null) ?? null,
    price_usd: lr.price_usd != null ? Number(lr.price_usd) : null,
    likes_count: likesTotal,
  };

  const { data: viewEvents } = await admin
    .from("listing_view_events")
    .select("counted_at")
    .eq("listing_type", listingType)
    .eq("listing_id", listingId)
    .gte("counted_at", startIso);

  const runCol = listingType === "workflow" ? "workflow_id" : "prompt_id";
  const { data: runRowsRaw } = await admin
    .from("runs")
    .select("started_at, status, ended_at, metadata")
    .eq(runCol, listingId)
    .gte("started_at", startIso)
    .not("ended_at", "is", null)
    .in("status", ["success", "error", "canceled"]);

  const runRows = (runRowsRaw ?? []).filter((r) =>
    isMarketplaceUnifiedRunMetadata(
      (r as { metadata?: Record<string, unknown> | null }).metadata ?? null,
    ),
  );

  const { data: earnRows } = await admin
    .from("creator_earnings")
    .select("created_at, gross_amount_cents, status")
    .eq("creator_id", creatorId)
    .eq("purchase_type", listingType)
    .eq("purchase_id", listingId)
    .in("status", ["pending_claim", "pending", "available", "paid"])
    .gte("created_at", startIso);

  const dayList = eachDay(start, end);
  const viewsByDay = new Map<string, number>();
  const runsByDay = new Map<string, number>();
  const salesCentsByDay = new Map<string, number>();

  for (const d of dayList) {
    viewsByDay.set(d, 0);
    runsByDay.set(d, 0);
    salesCentsByDay.set(d, 0);
  }

  for (const ev of viewEvents ?? []) {
    const t = (ev as { counted_at?: string }).counted_at;
    if (!t) continue;
    const k = t.slice(0, 10);
    viewsByDay.set(k, (viewsByDay.get(k) ?? 0) + 1);
  }

  for (const r of runRows) {
    const t = (r as { started_at?: string }).started_at;
    if (!t) continue;
    const k = t.slice(0, 10);
    runsByDay.set(k, (runsByDay.get(k) ?? 0) + 1);
  }

  for (const e of earnRows ?? []) {
    const t = (e as { created_at?: string }).created_at;
    const cents = (e as { gross_amount_cents?: number }).gross_amount_cents ?? 0;
    if (!t) continue;
    const k = t.slice(0, 10);
    salesCentsByDay.set(k, (salesCentsByDay.get(k) ?? 0) + cents);
  }

  const series = dayList.map((date) => ({
    date,
    views: viewsByDay.get(date) ?? 0,
    runs: runsByDay.get(date) ?? 0,
    salesCents: salesCentsByDay.get(date) ?? 0,
    likes: likesTotal,
    salesUsd: (salesCentsByDay.get(date) ?? 0) / 100,
  }));

  const totalViews = (viewEvents ?? []).length;
  const totalRuns = runRows.length;
  const purchasesCount = (earnRows ?? []).length;
  const totalSalesCents = (earnRows ?? []).reduce(
    (s, e) => s + ((e as { gross_amount_cents?: number }).gross_amount_cents ?? 0),
    0,
  );

  const viewToRunPct =
    totalViews > 0 ? Math.round(((100 * totalRuns) / totalViews) * 10) / 10 : null;
  const runToPurchasePct =
    totalRuns > 0 ? Math.round(((100 * purchasesCount) / totalRuns) * 10) / 10 : null;

  return NextResponse.json({
    listingType,
    listingId,
    period,
    listing,
    series,
    summary: {
      totalViews,
      totalRuns,
      purchasesCount,
      totalSalesCents,
      likesTotal,
      viewToRunPct,
      runToPurchasePct,
    },
  });
}
