import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveActorContext } from "@/lib/auth/actor-context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

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

    const { data: earnings, count } = await supabase
      .from("creator_earnings")
      .select("*", { count: "exact" })
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const transactions = await Promise.all(
      (earnings || []).map(async (earning) => {
        let resource = null;

        if (earning.purchase_type === "workflow") {
          const { data } = await supabase
            .from("workflows")
            .select("title, edgaze_code")
            .eq("id", earning.purchase_id)
            .single();
          resource = data;
        } else if (earning.purchase_type === "prompt") {
          const { data } = await supabase
            .from("prompts")
            .select("title, edgaze_code")
            .eq("id", earning.purchase_id)
            .single();
          resource = data;
        }

        return {
          id: earning.id,
          type: earning.purchase_type,
          title: resource?.title || "Unknown",
          code: resource?.edgaze_code || "",
          grossAmountCents: earning.gross_amount_cents,
          platformFeeCents: earning.platform_fee_cents,
          netAmountCents: earning.net_amount_cents,
          status: earning.status,
          createdAt: earning.created_at,
          paidAt: earning.paid_at,
        };
      }),
    );

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error("[CREATOR TRANSACTIONS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}
