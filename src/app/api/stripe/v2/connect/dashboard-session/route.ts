/**
 * Dashboard Session - Create Account Session for embedded Connect dashboard
 *
 * Returns client_secret for Connect.js to mount earnings dashboard components:
 * notification_banner, payments, payouts, balances, account_management, documents.
 *
 * Auth: Bearer token (same as account-session). For use from dashboard/earnings.
 */

import { NextResponse } from "next/server";
import { getUserAndClient } from "@/lib/auth/server";
import { resolveActorContext } from "@/lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@/lib/auth/sensitive-action";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createConnectDashboardAccountSession } from "@/lib/stripe/connect-marketplace";
import { reconcileCreatorPayoutAccount } from "@/lib/stripe/reconcile-payout-account";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { user } = await getUserAndClient(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);

    const admin = createSupabaseAdminClient();
    const reconciled = await reconcileCreatorPayoutAccount({
      supabase: admin,
      creatorId: user.id,
      source: "v2.dashboard-session",
    });

    if (!reconciled) {
      return NextResponse.json({ error: "Connect account not found" }, { status: 404 });
    }

    if (!reconciled.status.readyForPayouts) {
      return NextResponse.json({ error: "Connect account not active yet" }, { status: 400 });
    }

    const { clientSecret } = await createConnectDashboardAccountSession(reconciled.stripeAccountId);

    return NextResponse.json({ clientSecret });
  } catch (error: unknown) {
    if (error instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to create dashboard session";
    console.error("[STRIPE V2 CONNECT] Dashboard session error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
