import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcileCreatorPayoutAccount } from "@/lib/stripe/reconcile-payout-account";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function reconcilePendingClaimCreators(supabase: AdminSupabaseClient, source: string) {
  const { data: rows, error } = await supabase
    .from("creator_earnings")
    .select("creator_id")
    .eq("status", "pending_claim");

  if (error) {
    throw error;
  }

  const creatorIds = [...new Set((rows || []).map((row) => row.creator_id).filter(Boolean))];

  let activeCount = 0;
  let pendingCount = 0;
  let missingAccountCount = 0;
  const failures: Array<{ creatorId: string; error: string }> = [];

  for (const creatorId of creatorIds) {
    try {
      const reconciled = await reconcileCreatorPayoutAccount({
        supabase,
        creatorId,
        source: `${source}.${creatorId}`,
      });

      if (!reconciled) {
        missingAccountCount += 1;
      } else if (reconciled.status.readyForPayouts) {
        activeCount += 1;
      } else {
        pendingCount += 1;
      }
    } catch (error) {
      failures.push({
        creatorId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    scannedCount: creatorIds.length,
    activeCount,
    pendingCount,
    missingAccountCount,
    failures,
  };
}
