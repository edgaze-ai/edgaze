import { stripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

function isStillClaimable(deadline: string | null | undefined) {
  if (!deadline) {
    return true;
  }
  const time = new Date(deadline).getTime();
  return Number.isFinite(time) && time >= Date.now();
}

export async function syncPlatformPendingClaimReserve(
  supabase: AdminSupabaseClient,
  source: string,
) {
  const { data: pendingClaimRows, error } = await supabase
    .from("creator_earnings")
    .select("net_amount_cents, claim_deadline_at")
    .eq("status", "pending_claim");

  if (error) {
    throw error;
  }

  const reserveCents = (pendingClaimRows || []).reduce((sum, row) => {
    if (!isStillClaimable(row.claim_deadline_at)) {
      return sum;
    }
    return sum + Math.max(0, row.net_amount_cents || 0);
  }, 0);

  try {
    await stripe.balanceSettings.update({
      payments: {
        payouts: {
          minimum_balance_by_currency: {
            usd: reserveCents,
          },
        },
      },
    });
  } catch (error) {
    console.error(
      `[STRIPE] Failed to sync platform pending-claim reserve (${reserveCents} cents) via ${source}`,
      error,
    );
    throw error;
  }

  console.warn(
    `[STRIPE] Synced platform pending-claim reserve to ${reserveCents} cents via ${source}`,
  );

  return reserveCents;
}
