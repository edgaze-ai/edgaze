export const USER_API_KEY_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type UserApiKeyProvider = (typeof USER_API_KEY_PROVIDERS)[number];

export type UserApiKeyMetadata = {
  provider: UserApiKeyProvider;
  configured: boolean;
  updatedAt: string | null;
};
