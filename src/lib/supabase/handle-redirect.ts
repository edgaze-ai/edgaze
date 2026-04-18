import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { resolvePublicPromptRowForPath } from "@lib/supabase/prompt-storefront-resolve";
import { resolvePublishedWorkflowRowForPath } from "@lib/supabase/workflow-storefront-resolve";

function canonicalWorkflowPath(canonicalHandle: string, code: string) {
  return `/${encodeURIComponent(canonicalHandle)}/${encodeURIComponent(code)}`;
}

function canonicalPromptPath(canonicalHandle: string, code: string) {
  return `/p/${encodeURIComponent(canonicalHandle)}/${encodeURIComponent(code)}`;
}

/**
 * If ownerHandle is an old handle (in handle_history), resolve current handle and check
 * if a workflow exists for that user + edgazeCode. Returns redirect path (e.g. "/newHandle/code") or null.
 */
export async function getWorkflowRedirectPath(
  ownerHandle: string,
  edgazeCode: string,
): Promise<string | null> {
  if (!ownerHandle?.trim() || !edgazeCode?.trim()) return null;
  const supabase = createSupabaseAdminClient();
  const handleLower = ownerHandle.trim().toLowerCase();
  const code = edgazeCode.trim();

  const { data: historyRow } = await supabase
    .from("handle_history")
    .select("user_id")
    .eq("old_handle", handleLower)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (historyRow?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", historyRow.user_id)
      .maybeSingle();

    if (profile?.handle) {
      const { data: workflow } = await supabase
        .from("workflows")
        .select("id")
        .eq("owner_id", historyRow.user_id)
        .eq("edgaze_code", code)
        .eq("is_published", true)
        .is("removed_at", null)
        .maybeSingle();

      if (workflow) {
        return canonicalWorkflowPath(profile.handle, code);
      }
    }
  }

  const row = await resolvePublishedWorkflowRowForPath(supabase, ownerHandle, edgazeCode);
  if (!row) return null;
  if (row.is_public === false) return null;
  const canonical = String(row.owner_handle ?? "").trim();
  if (!canonical) return null;

  const target = canonicalWorkflowPath(canonical, code);
  const current = canonicalWorkflowPath(ownerHandle.trim(), code);
  if (target !== current) return target;
  return null;
}

/**
 * If ownerHandle is an old handle (in handle_history), resolve current handle and check
 * if a prompt exists for that user + edgazeCode. Returns redirect path (e.g. "/p/newHandle/code") or null.
 */
export async function getProductRedirectPath(
  ownerHandle: string,
  edgazeCode: string,
): Promise<string | null> {
  if (!ownerHandle?.trim() || !edgazeCode?.trim()) return null;
  const supabase = createSupabaseAdminClient();
  const handleLower = ownerHandle.trim().toLowerCase();
  const code = edgazeCode.trim();

  const { data: historyRow } = await supabase
    .from("handle_history")
    .select("user_id")
    .eq("old_handle", handleLower)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (historyRow?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", historyRow.user_id)
      .maybeSingle();

    if (profile?.handle) {
      const { data: prompt } = await supabase
        .from("prompts")
        .select("id")
        .eq("owner_id", String(historyRow.user_id))
        .eq("edgaze_code", code)
        .in("visibility", ["public", "unlisted"])
        .maybeSingle();

      if (prompt) {
        return canonicalPromptPath(profile.handle, code);
      }
    }
  }

  const row = await resolvePublicPromptRowForPath(supabase, ownerHandle, edgazeCode);
  if (!row) return null;
  const canonical = String((row as { owner_handle?: string | null }).owner_handle ?? "").trim();
  if (!canonical) return null;

  const target = canonicalPromptPath(canonical, code);
  const current = canonicalPromptPath(ownerHandle.trim(), code);
  if (target !== current) return target;
  return null;
}

/**
 * If handle is an old handle (in handle_history), return the current profile handle for redirect to /profile/{newHandle}.
 */
export async function getProfileRedirectHandle(handle: string): Promise<string | null> {
  if (!handle?.trim()) return null;
  const supabase = createSupabaseAdminClient();
  const handleLower = handle.trim().toLowerCase();

  const { data: historyRow } = await supabase
    .from("handle_history")
    .select("user_id")
    .eq("old_handle", handleLower)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!historyRow?.user_id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", historyRow.user_id)
    .maybeSingle();

  return profile?.handle ?? null;
}

/**
 * Fallback: resolve current profile handle from workflows/prompts owner_handle.
 * Use when handle_history is empty (e.g. after manual DB updates) so old profile URLs can still redirect.
 */
export async function getProfileRedirectByOwnerHandle(handle: string): Promise<string | null> {
  if (!handle?.trim()) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_current_handle_by_owner_handle", {
    owner_handle_input: handle.trim(),
  });
  if (error || data == null || typeof data !== "string" || !data.trim()) return null;
  return data.trim();
}
