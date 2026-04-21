import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { reconcileCreatorPayoutAccount } from "@/lib/stripe/reconcile-payout-account";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const result = await getUserAndClient(req);
    const user = result?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);

    const admin = createSupabaseAdminClient();
    const reconciled = await reconcileCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      source: "connect.dashboard",
    });

    if (!reconciled) {
      return NextResponse.json({ error: "Connect account not found" }, { status: 404 });
    }

    if (!reconciled.status.readyForPayouts) {
      return NextResponse.json({ error: "Account not active yet" }, { status: 400 });
    }

    const loginLink = await stripe.accounts.createLoginLink(reconciled.stripeAccountId);

    return NextResponse.json({
      success: true,
      url: loginLink.url,
    });
  } catch (error: any) {
    if (error instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[STRIPE CONNECT] Dashboard link error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create dashboard link" },
      { status: 500 },
    );
  }
}
