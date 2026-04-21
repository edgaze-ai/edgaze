import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveActorContext } from "@/lib/auth/actor-context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";

    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actor = await resolveActorContext(req, user);
    const creatorId = actor.effectiveProfileId;

    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    else if (period === "90d") daysBack = 90;
    else if (period === "all") daysBack = 365 * 10;

    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: earnings } = await supabase
      .from("creator_earnings")
      .select("net_amount_cents, created_at, status")
      .eq("creator_id", creatorId)
      .in("status", ["pending_claim", "pending", "available", "paid"])
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    const chartData: { date: string; amount: number }[] = [];
    const dateMap = new Map<string, number>();

    earnings?.forEach((earning) => {
      const date = new Date(earning.created_at).toISOString().split("T")[0];
      if (date) {
        const current = dateMap.get(date) || 0;
        dateMap.set(date, current + earning.net_amount_cents);
      }
    });

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      if (dateStr) {
        chartData.unshift({
          date: dateStr,
          amount: dateMap.get(dateStr) || 0,
        });
      }
    }

    const { data: topProducts } = await supabase
      .from("creator_earnings")
      .select("purchase_id, purchase_type, net_amount_cents, status")
      .eq("creator_id", creatorId)
      .in("status", ["pending_claim", "pending", "available", "paid"]);

    const productMap = new Map<string, { type: string; total: number; count: number }>();

    topProducts?.forEach((earning) => {
      const key = `${earning.purchase_type}:${earning.purchase_id}`;
      const current = productMap.get(key) || { type: earning.purchase_type, total: 0, count: 0 };
      current.total += earning.net_amount_cents;
      current.count += 1;
      productMap.set(key, current);
    });

    const topProductsArray = Array.from(productMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    const topProductsWithDetails = await Promise.all(
      topProductsArray.map(async ([key, data]) => {
        const [type, id] = key.split(":");
        const table = type === "workflow" ? "workflows" : "prompts";

        const { data: resource } = await supabase
          .from(table)
          .select("title, thumbnail_url, edgaze_code")
          .eq("id", id)
          .single();

        return {
          id,
          type,
          title: resource?.title || "Unknown",
          thumbnailUrl: resource?.thumbnail_url,
          code: resource?.edgaze_code,
          totalEarnings: data.total,
          salesCount: data.count,
        };
      }),
    );

    return NextResponse.json({
      chartData,
      topProducts: topProductsWithDetails,
    });
  } catch (error: any) {
    console.error("[CREATOR ANALYTICS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
