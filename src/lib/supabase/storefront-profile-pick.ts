import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When multiple listings share an edgaze_code (or owner_handle is stale vs profiles.handle),
 * pick the row whose owner_id matches the profile for the URL handle segment.
 */
export async function pickListingRowMatchingProfileOwner<T extends { owner_id?: string | null }>(
  supabase: SupabaseClient,
  rows: T[],
  ownerHandleFromUrl: string,
): Promise<T | null> {
  if (rows.length === 0) return null;

  const { data: profileData, error } = await supabase.rpc("get_profile_by_handle_insensitive", {
    handle_input: ownerHandleFromUrl.trim(),
  });
  if (error) return null;

  const profileRow = Array.isArray(profileData) ? profileData[0] : profileData;
  const profileId = (profileRow as { id?: string } | null)?.id;
  if (!profileId) return null;

  const matches = rows.filter(
    (r) => String(r.owner_id ?? "").toLowerCase() === String(profileId).toLowerCase(),
  );
  if (matches.length === 1) return matches[0];
  return null;
}
