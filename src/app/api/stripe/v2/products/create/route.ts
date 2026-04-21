/**
 * Create Product on Connected Account
 *
 * Uses Stripe-Account header to create products on the connected account.
 * Products are owned by the creator's Stripe account.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { stripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcileCreatorPayoutAccount } from "@/lib/stripe/reconcile-payout-account";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const actor = await resolveActorContext(req, user);
      assertNotImpersonating(actor.actorMode);
    } catch (error) {
      if (error instanceof ImpersonationForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }

    const body = await req.json();
    const { name, description, priceInCents, currency = "usd" } = body;

    if (!name || typeof priceInCents !== "number" || priceInCents < 0) {
      return NextResponse.json(
        { error: "name and priceInCents (positive number) required" },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const reconciled = await reconcileCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      source: "v2.products.create",
    });

    if (!reconciled || !reconciled.status.readyForPayouts) {
      return NextResponse.json(
        { error: "Connect account not active. Complete onboarding first." },
        { status: 400 },
      );
    }

    const product = await stripe.products.create(
      {
        name,
        description: description || undefined,
        default_price_data: {
          unit_amount: priceInCents,
          currency,
        },
        metadata: {
          edgaze_user_id: user.id,
        },
      },
      {
        stripeAccount: reconciled.stripeAccountId,
      },
    );

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        default_price: product.default_price,
        created: product.created,
      },
    });
  } catch (error: any) {
    console.error("[STRIPE V2] Create product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 },
    );
  }
}
