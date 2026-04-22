import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { findPurchaseForResource, type PurchaseTable } from "@/lib/purchases/ownership";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { grantPaidCheckoutSessionAccess } from "@/lib/stripe/webhook-processing";

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

    const initialLookup = await findPurchaseForResource({
      supabase,
      resourceId,
      buyerId: user.id,
      type,
    });
    const purchase =
      initialLookup.purchase?.stripe_checkout_session_id === sessionId
        ? initialLookup.purchase
        : null;

    if (purchase && purchase.status === "paid") {
      return NextResponse.json({
        confirmed: true,
        purchaseId: purchase.id,
        status: purchase.status,
      });
    }

    // Webhooks can lag or fail transiently even after Stripe has already captured payment.
    // Self-heal here so the checkout success page can grant access once payment is truly paid.
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionBuyerId = session.metadata?.buyer_id ?? null;
    const sessionResourceId =
      type === "workflow" ? session.metadata?.workflow_id : session.metadata?.prompt_id;
    const sessionPurchaseType = session.metadata?.purchase_type ?? null;

    if (
      session.payment_status === "paid" &&
      sessionBuyerId === user.id &&
      sessionResourceId === resourceId &&
      sessionPurchaseType === type
    ) {
      const admin = createSupabaseAdminClient();
      await grantPaidCheckoutSessionAccess(session, admin);

      const preferredTable: PurchaseTable | null =
        session.metadata?.source_table === "prompts" ? "prompt_purchases" : null;
      const grantedLookup = await findPurchaseForResource({
        supabase,
        resourceId,
        buyerId: user.id,
        type,
        preferredTable,
      });
      const grantedPurchase =
        grantedLookup.purchase?.stripe_checkout_session_id === sessionId
          ? grantedLookup.purchase
          : null;

      if (grantedPurchase && grantedPurchase.status === "paid") {
        return NextResponse.json({
          confirmed: true,
          purchaseId: grantedPurchase.id,
          status: grantedPurchase.status,
          recoveredFromWebhookDelay: true,
        });
      }
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
