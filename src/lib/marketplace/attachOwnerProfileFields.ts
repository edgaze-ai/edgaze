import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Pack = { avatar_url: string | null; is_verified_creator: boolean | null };

function mergeRow(
  row: Record<string, unknown>,
  byUuid: Map<string, Pack>,
  byLowerHandle: Map<string, Pack>,
) {
  const pack: Pack = {
    avatar_url: (row.avatar_url as string | null | undefined) ?? null,
    is_verified_creator: (row.is_verified_creator as boolean | null | undefined) ?? null,
  };
  if (row.id != null) byUuid.set(String(row.id).toLowerCase(), pack);
  const h = row.handle != null ? String(row.handle).trim().toLowerCase() : "";
  if (h) byLowerHandle.set(h, pack);
}

function pickPack(
  item: ListingOwnerFields,
  byUuid: Map<string, Pack>,
  byLowerHandle: Map<string, Pack>,
): Pack | undefined {
  const oid = item.owner_id?.trim();
  if (oid && UUID_RE.test(oid)) {
    const p = byUuid.get(oid.toLowerCase());
    if (p) return p;
  }
  const h = (item.owner_handle || "").trim().toLowerCase();
  if (h) return byLowerHandle.get(h);
  return undefined;
}

export interface ListingOwnerFields {
  owner_id: string | null;
  owner_handle: string | null;
  owner_avatar_url?: string | null;
  owner_is_verified_creator?: boolean | null;
}

/**
 * Fills owner_avatar_url + owner_is_verified_creator on listing rows using the service-role
 * client (server only). Avoids brittle anon batch queries from the browser.
 */
export async function attachOwnerProfileFields(
  supabase: SupabaseClient,
  items: ListingOwnerFields[],
): Promise<void> {
  if (items.length === 0) return;

  const byUuid = new Map<string, Pack>();
  const byLowerHandle = new Map<string, Pack>();

  const uuids = [
    ...new Set(
      items
        .map((i) => i.owner_id?.trim())
        .filter((id): id is string => Boolean(id && UUID_RE.test(id))),
    ),
  ];

  if (uuids.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, avatar_url, is_verified_creator")
      .in("id", uuids);
    if (error) {
      console.error("[attachOwnerProfileFields] profiles by id:", error.message);
    } else {
      for (const row of data ?? []) {
        mergeRow(row as unknown as Record<string, unknown>, byUuid, byLowerHandle);
      }
    }
  }

  const allHandleLowers = [
    ...new Set(items.map((i) => (i.owner_handle || "").trim().toLowerCase()).filter(Boolean)),
  ];

  const missingByHandle = allHandleLowers.filter((h) => !byLowerHandle.has(h));

  if (missingByHandle.length > 0) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("profiles_min_by_handles", {
      handles: missingByHandle,
    });
    if (!rpcErr && rpcData) {
      for (const row of rpcData as unknown[]) {
        mergeRow(row as Record<string, unknown>, byUuid, byLowerHandle);
      }
    }
  }

  const variants = new Set<string>();
  for (const item of items) {
    if (pickPack(item, byUuid, byLowerHandle)) continue;
    const raw = (item.owner_handle || "").trim();
    if (raw) {
      variants.add(raw);
      variants.add(raw.toLowerCase());
    }
  }

  if (variants.size > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, avatar_url, is_verified_creator")
      .in("handle", [...variants]);
    if (error) {
      console.error("[attachOwnerProfileFields] profiles by handle:", error.message);
    } else {
      for (const row of data ?? []) {
        mergeRow(row as unknown as Record<string, unknown>, byUuid, byLowerHandle);
      }
    }
  }

  for (const item of items) {
    const p = pickPack(item, byUuid, byLowerHandle);
    item.owner_avatar_url = p?.avatar_url ?? null;
    item.owner_is_verified_creator = p?.is_verified_creator ?? null;
  }
}
