import { createSupabaseAdminClient } from "@lib/supabase/admin";
import {
  isUserApiKeyVaultConfigured,
  sealUserApiKeySecret,
  unsealUserApiKeySecret,
} from "@lib/crypto/user-api-key-vault-crypto";
import type { UserApiKeyMetadata, UserApiKeyProvider } from "./constants";
import { USER_API_KEY_PROVIDERS } from "./constants";

export type { UserApiKeyMetadata, UserApiKeyProvider } from "./constants";
export { USER_API_KEY_PROVIDERS } from "./constants";

function isUuid(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

export function parseUserApiKeyProvider(raw: string): UserApiKeyProvider | null {
  const p = raw?.trim().toLowerCase();
  if (p === "openai" || p === "anthropic" || p === "gemini") return p;
  return null;
}

export async function listUserApiKeyMetadata(userId: string): Promise<UserApiKeyMetadata[]> {
  if (!isUuid(userId)) {
    return USER_API_KEY_PROVIDERS.map((provider) => ({
      provider,
      configured: false,
      updatedAt: null,
    }));
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_api_key_vault")
    .select("provider,updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[user-api-keys] list metadata failed:", error);
    return USER_API_KEY_PROVIDERS.map((provider) => ({
      provider,
      configured: false,
      updatedAt: null,
    }));
  }

  const byProv = new Map(
    (data ?? []).map((row: { provider: string; updated_at: string }) => [
      row.provider,
      row.updated_at,
    ]),
  );

  return USER_API_KEY_PROVIDERS.map((provider) => ({
    provider,
    configured: byProv.has(provider),
    updatedAt: (byProv.get(provider) as string | undefined) ?? null,
  }));
}

export async function upsertUserApiKeySecret(
  userId: string,
  provider: UserApiKeyProvider,
  plaintextSecret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(userId)) {
    return { ok: false, error: "Invalid user" };
  }
  if (!isUserApiKeyVaultConfigured()) {
    return { ok: false, error: "API key storage is not configured on this server." };
  }

  const trimmed = plaintextSecret.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Key is too short." };
  }
  if (trimmed.length > 8192) {
    return { ok: false, error: "Key is too long." };
  }

  let ciphertext: string;
  try {
    ciphertext = sealUserApiKeySecret(trimmed);
  } catch (e) {
    console.error("[user-api-keys] seal failed:", e);
    return { ok: false, error: "Could not protect key. Try again later." };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_api_key_vault").upsert(
    {
      user_id: userId,
      provider,
      ciphertext,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    console.error("[user-api-keys] upsert failed:", error);
    return { ok: false, error: "Failed to save key." };
  }

  return { ok: true };
}

export async function deleteUserApiKeySecret(
  userId: string,
  provider: UserApiKeyProvider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(userId)) {
    return { ok: false, error: "Invalid user" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_api_key_vault")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    console.error("[user-api-keys] delete failed:", error);
    return { ok: false, error: "Failed to remove key." };
  }

  return { ok: true };
}

/**
 * Decrypts stored keys for workflow execution (server-only). Returns partial map; skips rows that fail to decrypt.
 */
export async function loadDecryptedUserApiKeysForRun(userId: string): Promise<{
  openai?: string;
  anthropic?: string;
  gemini?: string;
}> {
  const out: { openai?: string; anthropic?: string; gemini?: string } = {};
  if (!isUuid(userId) || !isUserApiKeyVaultConfigured()) {
    return out;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_api_key_vault")
    .select("provider,ciphertext")
    .eq("user_id", userId);

  if (error || !data?.length) {
    if (error) console.error("[user-api-keys] load for run failed:", error);
    return out;
  }

  for (const row of data as { provider: string; ciphertext: string }[]) {
    try {
      const plain = unsealUserApiKeySecret(row.ciphertext);
      if (row.provider === "openai") out.openai = plain;
      else if (row.provider === "anthropic") out.anthropic = plain;
      else if (row.provider === "gemini") out.gemini = plain;
    } catch (e) {
      console.error("[user-api-keys] decrypt failed for provider:", row.provider, e);
    }
  }

  return out;
}
