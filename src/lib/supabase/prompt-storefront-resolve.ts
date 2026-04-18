import type { SupabaseClient } from "@supabase/supabase-js";
import { pickListingRowMatchingProfileOwner } from "@lib/supabase/storefront-profile-pick";

type PromptRow = Record<string, unknown>;

/**
 * Resolves a public/unlisted prompt row for a storefront path, including case-insensitive
 * owner_handle, admin ownership transfer, and unique-by-edgaze_code fallback.
 */
export async function resolvePublicPromptRowForPath(
  supabase: SupabaseClient,
  ownerHandle: string,
  edgazeCode: string,
): Promise<PromptRow | null> {
  const code = edgazeCode.trim();
  const handleLower = ownerHandle.trim().toLowerCase();

  const base = () =>
    supabase
      .from("prompts")
      .select("*")
      .eq("edgaze_code", code)
      .is("removed_at", null)
      .in("visibility", ["public", "unlisted"]);

  const { data: primary, error: primaryErr } = await base()
    .eq("owner_handle", ownerHandle.trim())
    .maybeSingle();

  if (primaryErr) return null;
  if (primary) return primary as PromptRow;

  const { data: withCode } = await base();
  const ci = withCode?.find(
    (r) =>
      (r as { owner_handle?: string | null }).owner_handle?.trim().toLowerCase() === handleLower,
  );
  if (ci) return ci as PromptRow;

  const { data: handoff } = await (supabase as any)
    .from("listing_owner_redirects")
    .select("listing_id")
    .eq("listing_type", "prompt")
    .eq("from_owner_handle_norm", handleLower)
    .eq("edgaze_code", code)
    .maybeSingle();

  if (handoff?.listing_id) {
    const { data: pr } = await supabase
      .from("prompts")
      .select("*")
      .eq("id", handoff.listing_id)
      .is("removed_at", null)
      .in("visibility", ["public", "unlisted"])
      .maybeSingle();
    if (pr) return pr as PromptRow;
  }

  const promptRows = (withCode ?? []) as Array<{ owner_id?: string | null }>;
  const profilePick = await pickListingRowMatchingProfileOwner(supabase, promptRows, ownerHandle);
  if (profilePick) return profilePick as PromptRow;

  if (!withCode?.length) return null;
  if (withCode.length === 1) return withCode[0] as PromptRow;
  return null;
}
