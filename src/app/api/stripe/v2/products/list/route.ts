/**
 * List Products for Connected Account
 *
 * Uses Stripe-Account header to list products from the connected account.
 * - Storefront: pass accountId as query (e.g. /api/stripe/v2/products/list?accountId=acct_xxx)
 * - Creator dashboard: omit accountId when authenticated to use creator's account
 *
 * In production, use a slug/handle instead of raw accountId for store URLs.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let accountId = searchParams.get("accountId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!accountId) {
      const supabase = await createServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!error && user) {
        const { data } = await supabase
          .from("stripe_connect_accounts")
          .select("stripe_account_id")
          .eq("user_id", user.id)
          .single();
        accountId = data?.stripe_account_id ?? null;
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId required (query or authenticated creator)" },
        { status: 400 },
      );
    }

    const products = await stripe.products.list(
      {
        limit: Math.min(limit, 100),
        active: true,
        expand: ["data.default_price"],
      },
      {
        stripeAccount: accountId,
      },
    );

    return NextResponse.json({
      products: products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        images: p.images,
        default_price:
          typeof p.default_price === "object" && p.default_price
            ? {
                id: p.default_price.id,
                unit_amount: p.default_price.unit_amount,
                currency: p.default_price.currency,
              }
            : p.default_price,
        metadata: p.metadata,
      })),
    });
  } catch (error: any) {
    console.error("[STRIPE V2] List products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list products" },
      { status: 500 },
    );
  }
}
