import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getExpressConnectAccountPayoutStatus } from "@/lib/stripe/connect-marketplace";
import { syncCreatorPayoutAccount } from "@/lib/stripe/webhook-processing";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type ReconcileOptions = {
  supabase: AdminSupabaseClient;
  creatorId: string;
  source: string;
};

export async function reconcileCreatorPayoutAccount({
  supabase,
  creatorId,
  source,
}: ReconcileOptions) {
  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", creatorId)
    .maybeSingle();

  if (!connectAccount?.stripe_account_id) {
    return null;
  }

  const status = await getExpressConnectAccountPayoutStatus(connectAccount.stripe_account_id);

  await syncCreatorPayoutAccount({
    supabase,
    creatorId,
    stripeAccountId: connectAccount.stripe_account_id,
    chargesEnabled: status.chargesEnabled,
    payoutsEnabled: status.payoutsEnabled,
    detailsSubmitted: status.detailsSubmitted,
    payoutSetupComplete: status.readyForPayouts,
    source,
  });

  return {
    stripeAccountId: connectAccount.stripe_account_id,
    status,
  };
}
