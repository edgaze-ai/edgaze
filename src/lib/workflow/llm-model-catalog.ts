/**
 * Canonical model IDs + routing for unified LLM Chat / LLM Image nodes.
 * Defaults bias toward output quality (conversion); free tier uses quality floors, not cheapest nano.
 */

export type AiKeyProvider = "openai" | "anthropic" | "google";

/** Default LLM Chat: Claude Sonnet 4.6 (Anthropic API alias; quality-first for creators). */
export const DEFAULT_LLM_CHAT_MODEL = "claude-sonnet-4-6";

/** Platform-funded builder test (no BYOK): prefer Claude Sonnet when Anthropic env exists, else GPT-5.4 mini — never nano. */
export const FREE_TIER_LLM_CHAT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/**
 * Anthropic retires snapshot model IDs; workflows may still store old values.
 * Map retired / alias IDs to a current API model so requests do not 404.
 */
const RETIRED_ANTHROPIC_CHAT_MODEL: Record<string, string> = {
  "claude-3-7-sonnet-20250219": "claude-sonnet-4-6",
  "claude-3-7-sonnet-latest": "claude-sonnet-4-6",
};

export function resolveAnthropicApiModel(modelId: string): string {
  const raw = (modelId || "").trim();
  if (!raw) return DEFAULT_LLM_CHAT_MODEL;
  const mapped = RETIRED_ANTHROPIC_CHAT_MODEL[raw.toLowerCase()];
  return mapped ?? raw;
}
export const FREE_TIER_LLM_CHAT_OPENAI_MODEL = "gpt-5.4-mini";

/** Legacy "OpenAI Chat" workflow nodes (spec `openai-chat` → canonical `llm-chat`) must stay on OpenAI. */
export const LEGACY_OPENAI_CHAT_MODEL = "gpt-4o-mini";

/** Legacy "OpenAI Image" nodes must use OpenAI image APIs only (not unified Gemini default). */
export const LEGACY_OPENAI_IMAGE_MODEL = "gpt-image-1-mini";

/** Default LLM Image: Nano Banana 2 (Gemini 3.1 Flash Image). */
export const DEFAULT_LLM_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

const OPENAI_CHAT_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-"];
const ANTHROPIC_PREFIXES = ["claude-"];
const GEMINI_PREFIXES = ["gemini-"];

/** Image: OpenAI gpt-image-* vs Gemini Nano Banana (flash image) models. */
export function resolveLlmImageProvider(modelId: string): AiKeyProvider {
  const m = (modelId || "").trim().toLowerCase();
  if (!m) return "google";
  if (m.startsWith("gemini-") || m.includes("flash-image")) return "google";
  if (m.startsWith("dall-e") || m.startsWith("gpt-image")) return "openai";
  return "google";
}

export type CostTier = "$" | "$$" | "$$$";
export type QualityTier = "fast" | "balanced" | "high";

export type LlmChatOption = {
  value: string;
  label: string;
  provider: AiKeyProvider;
  quality: QualityTier;
  cost: CostTier;
  recommended?: boolean;
};

/** Single dropdown: all providers; labels include quality + cost. */
export const LLM_CHAT_MODEL_OPTIONS: LlmChatOption[] = [
  // Anthropic — default quality path
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 — Recommended ⭐ · High quality",
    provider: "anthropic",
    quality: "high",
    cost: "$$",
    recommended: true,
  },
  {
    value: "claude-3-opus-20240229",
    label: "Claude 3 Opus · Premium · $$$",
    provider: "anthropic",
    quality: "high",
    cost: "$$$",
  },
  {
    value: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku · Fast · $",
    provider: "anthropic",
    quality: "fast",
    cost: "$",
  },
  // OpenAI
  {
    value: "gpt-5.4",
    label: "GPT-5.4 · High quality workflows · $$$",
    provider: "openai",
    quality: "high",
    cost: "$$$",
  },
  {
    value: "gpt-5.4-mini",
    label: "GPT-5.4 mini · Balanced · $$",
    provider: "openai",
    quality: "balanced",
    cost: "$$",
  },
  {
    value: "gpt-5.4-nano",
    label: "GPT-5.4 nano · Fast scaling · $",
    provider: "openai",
    quality: "fast",
    cost: "$",
  },
  {
    value: "o3",
    label: "o3 · Reasoning / agents · $$$",
    provider: "openai",
    quality: "high",
    cost: "$$$",
  },
  // Google
  {
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro · $$$",
    provider: "google",
    quality: "high",
    cost: "$$$",
  },
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash · Fast · $",
    provider: "google",
    quality: "fast",
    cost: "$",
  },
];

export function resolveLlmChatProvider(modelId: string): AiKeyProvider {
  const raw = (modelId || "").trim();
  const m = raw.toLowerCase();
  if (!m) return "anthropic";
  const catalogHit = LLM_CHAT_MODEL_OPTIONS.find(
    (o) => o.value === raw || o.value.toLowerCase() === m,
  );
  if (catalogHit) return catalogHit.provider;
  if (ANTHROPIC_PREFIXES.some((p) => m.startsWith(p))) return "anthropic";
  if (GEMINI_PREFIXES.some((p) => m.startsWith(p))) return "google";
  if (OPENAI_CHAT_PREFIXES.some((p) => m.startsWith(p))) return "openai";
  // Unknown → assume OpenAI (frontier IDs)
  return "openai";
}

/**
 * OpenAI Chat Completions: newer models reject `max_tokens` and require `max_completion_tokens`.
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */
export function openaiChatUsesMaxCompletionTokens(modelId: string): boolean {
  const m = (modelId || "").trim().toLowerCase();
  if (m.startsWith("gpt-5")) return true;
  // o-series (o1, o3, o4, …) use the completion-tokens parameter name in current API.
  if (/^o\d/i.test(m)) return true;
  return false;
}

export type LlmImageOption = {
  value: string;
  label: string;
  provider: AiKeyProvider;
  quality: QualityTier;
  cost: CostTier;
  recommended?: boolean;
};

export const LLM_IMAGE_MODEL_OPTIONS: LlmImageOption[] = [
  {
    value: "gemini-3.1-flash-image-preview",
    label: "Nano Banana 2 (Gemini 3.1 Flash Image Preview) — Recommended ⭐ · $",
    provider: "google",
    quality: "balanced",
    cost: "$",
    recommended: true,
  },
  {
    value: "gemini-2.5-flash-image",
    label: "Nano Banana (Gemini 2.5 Flash Image, original) · $",
    provider: "google",
    quality: "fast",
    cost: "$",
  },
  {
    value: "gpt-image-1-mini",
    label: "GPT Image 1 mini (OpenAI) · $",
    provider: "openai",
    quality: "fast",
    cost: "$",
  },
  {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5 (OpenAI) · $$",
    provider: "openai",
    quality: "high",
    cost: "$$",
  },
];

export const LLM_EMBEDDING_OPTIONS = [
  {
    value: "text-embedding-3-small",
    label: "text-embedding-3-small — Recommended · $",
  },
  {
    value: "text-embedding-3-large",
    label: "text-embedding-3-large — Premium RAG · $$",
  },
];

export function brandForLlmChatModel(modelId: string | undefined): AiKeyProvider {
  return resolveLlmChatProvider(modelId || DEFAULT_LLM_CHAT_MODEL);
}

export function brandForLlmImageModel(modelId: string | undefined): AiKeyProvider {
  return resolveLlmImageProvider(modelId || DEFAULT_LLM_IMAGE_MODEL);
}

/** Sizes supported by OpenAI GPT Image on `images/generations` (not used for Gemini image). */
export const OPENAI_GPT_IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;

/** Map inspector / legacy values to OpenAI GPT Image `quality` parameter. */
export function openaiGptImageQualityParam(quality: string | undefined): "low" | "medium" | "high" {
  const q = (quality || "medium").toLowerCase();
  if (q === "hd" || q === "high") return "high";
  if (q === "standard" || q === "medium") return "medium";
  if (q === "low") return "low";
  return "medium";
}
