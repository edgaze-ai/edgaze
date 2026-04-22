import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAccessiblePurchaseForResource } from "@/lib/purchases/ownership";
import { stripe } from "@/lib/stripe/client";
import {
  canRouteMarketplaceFundsToConnectedAccount,
  getExpressConnectAccountPayoutStatus,
} from "@/lib/stripe/connect-marketplace";
import { stripeConfig } from "@/lib/stripe/config";
import {
  calculatePaymentSplitForPercentage,
  resolvePlatformFeePercentageForCreator,
} from "@/lib/stripe/fee-policy";
import { MIN_TRANSACTION_USD, WORKFLOW_MIN_USD } from "@/lib/marketplace/pricing";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Use Bearer token auth (client sends Authorization: Bearer <accessToken>).
    // Cookie-based auth is unreliable because session lives in localStorage.
    const { user, supabase } = await getUserAndClient(req);

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const actor = await resolveActorContext(req, user);
      assertNotImpersonating(actor.actorMode);
    } catch (e) {
      if (e instanceof ImpersonationForbiddenError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const body = await req.json();
    const { workflowId, promptId, type, sourceTable, embedded } = body;

    if (!type || (type !== "workflow" && type !== "prompt")) {
      return NextResponse.json({ error: "Invalid purchase type" }, { status: 400 });
    }

    const resourceId = type === "workflow" ? workflowId : promptId;
    if (!resourceId) {
      return NextResponse.json({ error: "Resource ID required" }, { status: 400 });
    }

    // sourceTable: "prompts" = from /p/ page (prompts table has both prompts and workflows); "workflows" = from /handle/ page
    const table =
      sourceTable === "prompts" ? "prompts" : type === "workflow" ? "workflows" : "prompts";
    const { data: resource, error: resourceError } = await supabase
      .from(table)
      .select(
        "id, title, description, price_usd, is_paid, owner_id, owner_handle, thumbnail_url, edgaze_code",
      )
      .eq("id", resourceId)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (!resource.is_paid || !resource.price_usd || resource.price_usd <= 0) {
      return NextResponse.json({ error: "Resource is not for sale" }, { status: 400 });
    }

    const minAmount = type === "workflow" ? WORKFLOW_MIN_USD : MIN_TRANSACTION_USD;
    if (resource.price_usd < minAmount) {
      return NextResponse.json(
        { error: `Minimum transaction amount is $${minAmount}` },
        { status: 400 },
      );
    }

    if (resource.owner_id === user.id) {
      return NextResponse.json({ error: "Cannot purchase your own content" }, { status: 400 });
    }

    const existingPurchase = await findAccessiblePurchaseForResource({
      supabase,
      resourceId,
      buyerId: user.id,
      preferredTable:
        sourceTable === "prompts"
          ? "prompt_purchases"
          : type === "workflow"
            ? "workflow_purchases"
            : "prompt_purchases",
      type,
      allowedStatuses: ["paid"],
    });

    if (existingPurchase.accessible) {
      return NextResponse.json({ error: "You already own this content" }, { status: 400 });
    }

    const { data: creator } = await supabase
      .from("profiles")
      .select("handle, full_name, email")
      .eq("id", resource.owner_id)
      .single();

    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, account_status, payouts_enabled, charges_enabled, details_submitted",
      )
      .eq("user_id", resource.owner_id)
      .single();

    let creatorHasConnect =
      connectAccount &&
      connectAccount.account_status === "active" &&
      (connectAccount.payouts_enabled === true || connectAccount.details_submitted === true);

    if (connectAccount?.stripe_account_id) {
      try {
        const liveStatus = await getExpressConnectAccountPayoutStatus(
          connectAccount.stripe_account_id,
        );
        creatorHasConnect = canRouteMarketplaceFundsToConnectedAccount(liveStatus);

        await syncCreatorPayoutAccount({
          supabase: createSupabaseAdminClient(),
          creatorId: resource.owner_id,
          stripeAccountId: connectAccount.stripe_account_id,
          chargesEnabled: liveStatus.chargesEnabled,
          payoutsEnabled: liveStatus.payoutsEnabled,
          detailsSubmitted: liveStatus.detailsSubmitted,
          payoutSetupComplete: liveStatus.readyForPayouts,
          source: "checkout.create",
        });
      } catch (liveStatusError) {
        console.error("[STRIPE CHECKOUT] Live connect status check failed:", liveStatusError);
        creatorHasConnect =
          connectAccount.account_status === "active" ||
          (connectAccount.details_submitted === true && connectAccount.charges_enabled !== false);
      }
    }

    const { data: buyer } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const admin = createSupabaseAdminClient();
    const amountCents = Math.round(resource.price_usd * 100);
    const { activeOverride, platformFeePercentage } = await resolvePlatformFeePercentageForCreator(
      admin,
      resource.owner_id,
      stripeConfig.platformFeePercentage,
    );
    const { platformFeeCents, creatorNetCents } = calculatePaymentSplitForPercentage(
      amountCents,
      platformFeePercentage,
    );

    // Stripe enforces 2048 char limit on URLs (images, success_url, cancel_url)
    const imageUrls =
      resource.thumbnail_url && resource.thumbnail_url.length <= 2048
        ? [resource.thumbnail_url]
        : undefined;

    const baseUrl =
      (stripeConfig.appUrl || "").replace(/\?.*$/, "").replace(/#.*$/, "") || "https://edgaze.ai";
    const ownerHandle =
      (resource as { owner_handle?: string }).owner_handle || creator?.handle || "creator";
    const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&resource_id=${resourceId}&type=${type}`;
    const cancelUrl =
      type === "prompt"
        ? `${baseUrl}/p/${encodeURIComponent(ownerHandle)}/${encodeURIComponent(resource.edgaze_code || "")}`
        : `${baseUrl}/${encodeURIComponent(ownerHandle)}/${encodeURIComponent(resource.edgaze_code || "")}`;

    if (successUrl.length > 2048 || cancelUrl.length > 2048) {
      console.error("[STRIPE CHECKOUT] URL too long", {
        successLen: successUrl.length,
        cancelLen: cancelUrl.length,
      });
      return NextResponse.json(
        { error: "Configuration error: checkout URLs exceed limit. Please contact support." },
        { status: 500 },
      );
    }

    const baseMetadata = {
      workflow_id: type === "workflow" ? resourceId : "",
      prompt_id: type === "prompt" ? resourceId : "",
      buyer_id: user.id,
      creator_id: resource.owner_id,
      connected_account_id: creatorHasConnect ? (connectAccount?.stripe_account_id ?? "") : "",
      purchase_type: type,
      source_table: sourceTable || (type === "workflow" ? "workflows" : "prompts"),
      edgaze_code: resource.edgaze_code || "",
      platform_fee_percentage: String(platformFeePercentage),
      platform_fee_override_id: activeOverride?.id || "",
      creator_net_cents: String(creatorNetCents),
      platform_fee_cents: String(platformFeeCents),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: resource.title,
              description: resource.description || undefined,
              images: imageUrls,
              metadata: {
                edgaze_code: resource.edgaze_code || "",
                creator_handle: creator?.handle || "",
                creator_name: creator?.full_name || "",
                type,
              },
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: creatorHasConnect
        ? {
            application_fee_amount: platformFeeCents,
            transfer_data: {
              destination: connectAccount!.stripe_account_id,
            },
            metadata: baseMetadata,
            statement_descriptor: "EDGAZE",
            statement_descriptor_suffix: (resource.edgaze_code || "").slice(0, 10),
          }
        : {
            metadata: baseMetadata,
            statement_descriptor: "EDGAZE",
            statement_descriptor_suffix: (resource.edgaze_code || "").slice(0, 10),
          },
      customer_email: buyer?.email,
      metadata: {
        workflow_id: type === "workflow" ? resourceId : "",
        prompt_id: type === "prompt" ? resourceId : "",
        buyer_id: user.id,
        creator_id: resource.owner_id,
        connected_account_id: creatorHasConnect ? (connectAccount?.stripe_account_id ?? "") : "",
        purchase_type: type,
        source_table: sourceTable || (type === "workflow" ? "workflows" : "prompts"),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      custom_text: {
        submit: {
          message: "Secure payment powered by Stripe",
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error("[STRIPE CHECKOUT] Create session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
