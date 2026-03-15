/**
 * Dashboard Session - Create Account Session for embedded Connect dashboard
 *
 * Returns client_secret for Connect.js to mount earnings dashboard components:
 * notification_banner, payments, payouts, balances, account_management, documents.
 *
 * Auth: Bearer token (same as account-session). For use from dashboard/earnings.
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createDashboardAccountSession } from "@/lib/stripe/connect-v2";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: connectAccount, error: dbError } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, account_status")
      .eq("user_id", user.id)
      .single();

    if (dbError || !connectAccount) {
      return NextResponse.json({ error: "Connect account not found" }, { status: 404 });
    }

    if (connectAccount.account_status !== "active") {
      return NextResponse.json({ error: "Connect account not active yet" }, { status: 400 });
    }

    const { clientSecret } = await createDashboardAccountSession(connectAccount.stripe_account_id);

    return NextResponse.json({ clientSecret });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create dashboard session";
    console.error("[STRIPE V2 CONNECT] Dashboard session error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
