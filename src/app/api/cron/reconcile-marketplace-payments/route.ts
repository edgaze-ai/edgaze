import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { grantPaidCheckoutSessionAccess } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isMarketplaceCheckoutSession(session: {
  mode?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
}) {
  return (
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    !!session.metadata?.buyer_id &&
    !!session.metadata?.creator_id &&
    !!session.metadata?.purchase_type
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const hours = Math.max(
    1,
    Math.min(168, Number.parseInt(url.searchParams.get("hours") || "48", 10)),
  );
  const limit = Math.max(
    1,
    Math.min(100, Number.parseInt(url.searchParams.get("limit") || "100", 10)),
  );
  const createdGte = Math.floor(Date.now() / 1000) - hours * 60 * 60;

  try {
    const supabase = createSupabaseAdminClient();
    const [sessions, webhookEndpoints] = await Promise.all([
      stripe.checkout.sessions.list({
        created: { gte: createdGte },
        limit,
      }),
      stripe.webhookEndpoints.list({
        limit: 20,
      }),
    ]);

    const marketplaceSessions = sessions.data.filter(isMarketplaceCheckoutSession);

    let repairedCount = 0;
    let healthyCount = 0;
    const failures: Array<{ sessionId: string; error: string }> = [];

    for (const session of marketplaceSessions) {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      const purchaseTable =
        session.metadata?.source_table === "prompts"
          ? "prompt_purchases"
          : session.metadata?.purchase_type === "workflow"
            ? "workflow_purchases"
            : "prompt_purchases";

      const [{ data: purchase }, { data: earning }] = await Promise.all([
        supabase
          .from(purchaseTable)
          .select("id, status")
          .eq("stripe_checkout_session_id", session.id)
          .maybeSingle(),
        paymentIntentId
          ? supabase
              .from("creator_earnings")
              .select("id, status")
              .eq("stripe_payment_intent_id", paymentIntentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (purchase && earning) {
        healthyCount += 1;
        continue;
      }

      try {
        await grantPaidCheckoutSessionAccess(session, supabase);
        repairedCount += 1;
      } catch (error) {
        failures.push({
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (webhookEndpoints.data.length === 0) {
      console.error(
        "[CRON] reconcile-marketplace-payments detected zero live Stripe webhook endpoints",
      );
    }

    return NextResponse.json({
      success: failures.length === 0,
      hours,
      limit,
      webhookEndpointCount: webhookEndpoints.data.length,
      scannedCount: marketplaceSessions.length,
      repairedCount,
      healthyCount,
      failures,
    });
  } catch (error) {
    console.error("[CRON] reconcile-marketplace-payments error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reconcile marketplace payments",
      },
      { status: 500 },
    );
  }
}
