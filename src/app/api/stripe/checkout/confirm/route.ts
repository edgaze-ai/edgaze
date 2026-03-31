import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const resourceId = searchParams.get("resource_id");
    const type = searchParams.get("type");

    if (!sessionId || !resourceId || !type) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Match /api/stripe/checkout/create: Bearer from localStorage is primary; cookies are fallback.
    const { user, supabase } = await getUserAndClient(req);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchaseTable = type === "workflow" ? "workflow_purchases" : "prompt_purchases";
    const resourceColumn = type === "workflow" ? "workflow_id" : "prompt_id";

    const { data: purchase } = await supabase
      .from(purchaseTable)
      .select("id, status, stripe_checkout_session_id")
      .eq(resourceColumn, resourceId)
      .eq("buyer_id", user.id)
      .eq("stripe_checkout_session_id", sessionId)
      .single();

    if (purchase && purchase.status === "paid") {
      return NextResponse.json({
        confirmed: true,
        purchaseId: purchase.id,
        status: purchase.status,
      });
    }

    return NextResponse.json({
      confirmed: false,
      status: purchase?.status || "pending",
    });
  } catch (error: any) {
    console.error("[STRIPE CHECKOUT] Confirm error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm purchase" },
      { status: 500 },
    );
  }
}
