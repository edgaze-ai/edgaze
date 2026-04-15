export const USER_API_KEY_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type UserApiKeyProvider = (typeof USER_API_KEY_PROVIDERS)[number];

export type UserApiKeyMetadata = {
  provider: UserApiKeyProvider;
  configured: boolean;
  updatedAt: string | null;
};

/** Maps workflow execution key kinds (Gemini uses `"google"`) to persisted vault providers. */
export function vaultProvidersForWorkflowKeys(
  keys: Set<"openai" | "anthropic" | "google">,
): UserApiKeyProvider[] {
  const out: UserApiKeyProvider[] = [];
  if (keys.has("openai")) out.push("openai");
  if (keys.has("anthropic")) out.push("anthropic");
  if (keys.has("google")) out.push("gemini");
  return out;
}
