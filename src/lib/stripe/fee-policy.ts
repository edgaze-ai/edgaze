import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export type ActiveCreatorFeeOverride = {
  id: string;
  creator_id: string;
  platform_fee_percentage: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export function calculatePaymentSplitForPercentage(
  amountCents: number,
  platformFeePercentage: number,
) {
  const clampedPercentage = Math.min(100, Math.max(0, platformFeePercentage));
  const platformFeeCents = Math.round(amountCents * (clampedPercentage / 100));
  const creatorNetCents = Math.max(0, amountCents - platformFeeCents);

  return {
    grossAmountCents: amountCents,
    platformFeePercentage: clampedPercentage,
    platformFeeCents,
    creatorNetCents,
  };
}

export async function getActiveCreatorFeeOverride(
  supabase: AdminSupabaseClient,
  creatorId: string,
): Promise<ActiveCreatorFeeOverride | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("creator_platform_fee_overrides")
    .select("id, creator_id, platform_fee_percentage, starts_at, ends_at, reason")
    .eq("creator_id", creatorId)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function resolvePlatformFeePercentageForCreator(
  supabase: AdminSupabaseClient,
  creatorId: string,
  defaultPlatformFeePercentage: number,
) {
  const activeOverride = await getActiveCreatorFeeOverride(supabase, creatorId);

  return {
    activeOverride,
    platformFeePercentage: activeOverride?.platform_fee_percentage ?? defaultPlatformFeePercentage,
  };
}
