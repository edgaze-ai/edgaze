/**
 * Keep prompts/workflows.runs_count aligned with completed marketplace rows in `runs`.
 * Server-only; uses service role.
 */
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { sanitizeLogText } from "@lib/security/url-policy";

export type ListingTypeForMetrics = "prompt" | "workflow";

function tableForType(t: ListingTypeForMetrics): "prompts" | "workflows" {
  return t === "workflow" ? "workflows" : "prompts";
}

/** Same rules as listing-metrics: count unless builder test or hosted demo. */
export function isMarketplaceUnifiedRunMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return true;
  const m = metadata as Record<string, unknown>;
  if (m.isBuilderTest === true) return false;
  if (m.isDemo === true) return false;
  return true;
}

/**
 * +1 on the listing when a marketplace run reaches a terminal state in `runs`.
 * One increment per completed analytics row (no cooldown).
 */
export async function incrementMarketplaceListingRunCount(params: {
  listingType: ListingTypeForMetrics;
  listingId: string;
}): Promise<void> {
  const { listingType, listingId } = params;
  const supabase = createSupabaseAdminClient();
  const tbl = tableForType(listingType);
  const { data: item, error: selErr } = await supabase
    .from(tbl)
    .select("runs_count")
    .eq("id", listingId)
    .maybeSingle();
  if (selErr || !item) return;
  const cur = Number((item as { runs_count?: number | null }).runs_count ?? 0);
  const { error: upErr } = await supabase
    .from(tbl)
    .update({ runs_count: cur + 1 })
    .eq("id", listingId);
  if (upErr) {
    console.error(
      "[incrementMarketplaceListingRunCount]",
      sanitizeLogText(listingType),
      sanitizeLogText(listingId),
      upErr,
    );
  }
}
