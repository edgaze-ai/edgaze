/**
 * Get Checkout Session status (for embedded return page).
 * Requires session_id and accountId (connected account) in query.
 * No auth required — return page is hit after Stripe redirect; session_id is the secret.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const accountId = searchParams.get("accountId");

    if (!sessionId || !accountId) {
      return NextResponse.json({ error: "session_id and accountId required" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ["customer_details"] },
      { stripeAccount: accountId },
    );

    return NextResponse.json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email ?? null,
    });
  } catch (error: any) {
    console.error("[STRIPE V2] Session status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get session status" },
      { status: 500 },
    );
  }
}
