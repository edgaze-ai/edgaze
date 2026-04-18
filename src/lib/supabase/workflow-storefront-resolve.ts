import type { SupabaseClient } from "@supabase/supabase-js";
import { pickListingRowMatchingProfileOwner } from "@lib/supabase/storefront-profile-pick";

/** Matches /api/workflow/storefront-detail select list. */
export const WORKFLOW_STOREFRONT_COLUMNS = [
  "id",
  "owner_id",
  "owner_name",
  "owner_handle",
  "title",
  "description",
  "tags",
  "banner_url",
  "thumbnail_url",
  "edgaze_code",
  "is_public",
  "is_published",
  "monetisation_mode",
  "is_paid",
  "price_usd",
  "views_count",
  "likes_count",
  "runs_count",
  "demo_images",
  "output_demo_urls",
  "graph_json",
  "graph",
  "removed_at",
  "removed_reason",
  "removed_by",
  "demo_mode_enabled",
  "demo_token",
].join(",");

type WorkflowRow = Record<string, unknown>;

/**
 * Resolves a published workflow row for a storefront path segment, including:
 * case-insensitive owner_handle, admin ownership transfer (listing_owner_redirects),
 * and unique-by-edgaze_code fallback (same rules as server redirect + API).
 */
export async function resolvePublishedWorkflowRowForPath(
  supabase: SupabaseClient,
  ownerHandle: string,
  edgazeCode: string,
): Promise<WorkflowRow | null> {
  const code = edgazeCode.trim();
  const handleLower = ownerHandle.trim().toLowerCase();
  const cols = WORKFLOW_STOREFRONT_COLUMNS;

  const { data: primary, error: primaryErr } = await supabase
    .from("workflows")
    .select(cols)
    .eq("owner_handle", ownerHandle.trim())
    .eq("edgaze_code", code)
    .eq("is_published", true)
    .is("removed_at", null)
    .maybeSingle();

  if (primaryErr) return null;
  if (primary) return primary as unknown as WorkflowRow;

  const { data: withCode } = await supabase
    .from("workflows")
    .select(cols)
    .eq("edgaze_code", code)
    .eq("is_published", true)
    .is("removed_at", null);

  const rows = (withCode ?? []) as Array<{
    owner_id?: string | null;
    owner_handle?: string | null;
    is_public?: boolean | null;
  }>;
  const ci = rows.find((r) => r.owner_handle?.trim().toLowerCase() === handleLower);
  if (ci) return ci as unknown as WorkflowRow;

  // Table added in migration `listing_owner_redirects`; regenerate Supabase types after deploy.
  const { data: handoff } = await (supabase as any)
    .from("listing_owner_redirects")
    .select("listing_id")
    .eq("listing_type", "workflow")
    .eq("from_owner_handle_norm", handleLower)
    .eq("edgaze_code", code)
    .maybeSingle();

  if (handoff?.listing_id) {
    const { data: wf } = await supabase
      .from("workflows")
      .select(cols)
      .eq("id", handoff.listing_id)
      .eq("is_published", true)
      .is("removed_at", null)
      .maybeSingle();
    if (wf && (wf as { is_public?: boolean | null }).is_public !== false) {
      return wf as unknown as WorkflowRow;
    }
  }

  const profilePick = await pickListingRowMatchingProfileOwner(supabase, rows, ownerHandle);
  if (profilePick && profilePick.is_public !== false) {
    return profilePick as unknown as WorkflowRow;
  }

  if (!rows.length) return null;
  if (rows.length === 1) {
    const lone = rows[0];
    if (lone.is_public === false) return null;
    return lone as unknown as WorkflowRow;
  }
  return null;
}
