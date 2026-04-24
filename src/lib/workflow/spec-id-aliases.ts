/**
 * Canonical workflow node spec IDs. Legacy openai-* IDs map to llm-* for backward compatibility.
 */

import {
  type AiKeyProvider,
  DEFAULT_LLM_CHAT_MODEL,
  DEFAULT_LLM_IMAGE_MODEL,
  resolveLlmChatProvider,
  resolveLlmImageProvider,
} from "./llm-model-catalog";

/** Set on compile/normalize when the source node was `openai-chat` (stored as canonical `llm-chat`). */
export const LEGACY_OPENAI_CHAT_CONFIG_FLAG = "__edgaze_legacy_openai_chat" as const;

/** Set when the source node was `openai-image`. */
export const LEGACY_OPENAI_IMAGE_CONFIG_FLAG = "__edgaze_legacy_openai_image" as const;

export type { AiKeyProvider } from "./llm-model-catalog";

export const LEGACY_TO_CANONICAL: Record<string, string> = {
  "openai-chat": "llm-chat",
  "openai-embeddings": "llm-embeddings",
  "openai-image": "llm-image",
  "claude-chat": "llm-chat",
  "gemini-chat": "llm-chat",
};

const LEGACY_TO_CANONICAL_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL).map(([k, v]) => [k.toLowerCase(), v]),
);

export function canonicalSpecId(specId: string): string {
  const trimmed = String(specId ?? "").trim();
  if (!trimmed) return trimmed;
  return (
    LEGACY_TO_CANONICAL[trimmed] ?? LEGACY_TO_CANONICAL_LOWER[trimmed.toLowerCase()] ?? trimmed
  );
}

/** True for unified chat nodes (includes legacy openai/claude/gemini spec ids on saved graphs). */
export function isAiLlmChatSpec(specId: string): boolean {
  return canonicalSpecId(specId) === "llm-chat";
}

export const AI_EMBEDDING_SPECS = new Set(["llm-embeddings", "openai-embeddings"]);

export const AI_IMAGE_SPECS = new Set(["llm-image", "openai-image"]);

export function isAiChatSpec(specId: string): boolean {
  return isAiLlmChatSpec(specId);
}

export function isAiEmbeddingSpec(specId: string): boolean {
  return AI_EMBEDDING_SPECS.has(specId);
}

export function isAiImageSpec(specId: string): boolean {
  return AI_IMAGE_SPECS.has(specId);
}

/** @deprecated Prefer resolvePremiumKeyProvider(node) — llm-chat / llm-image are multi-provider. */
export function isOpenAiBackedSpec(specId: string): boolean {
  const c = canonicalSpecId(specId);
  return c === "llm-chat" || c === "llm-image" || c === "llm-embeddings";
}

/**
 * Which provider key this node needs. Pass `config` for unified llm-chat / llm-image (model-driven).
 */
export function providerForAiSpec(specId: string, config?: Record<string, unknown>): AiKeyProvider {
  const c = canonicalSpecId(specId);
  if (c === "llm-chat" || specId === "openai-chat") {
    if (specId === "openai-chat" || config?.[LEGACY_OPENAI_CHAT_CONFIG_FLAG] === true) {
      return "openai";
    }
    const m = (config?.model as string) || DEFAULT_LLM_CHAT_MODEL;
    return resolveLlmChatProvider(m);
  }
  if (c === "llm-image" || specId === "openai-image") {
    if (specId === "openai-image" || config?.[LEGACY_OPENAI_IMAGE_CONFIG_FLAG] === true) {
      return "openai";
    }
    const m = (config?.model as string) || DEFAULT_LLM_IMAGE_MODEL;
    return resolveLlmImageProvider(m);
  }
  if (c === "llm-embeddings" || specId === "openai-embeddings") return "openai";
  if (specId === "condition") return "openai";
  return "openai";
}

/** Premium AI node → API key provider (null if not a premium AI spec). */
export function resolvePremiumKeyProvider(node: {
  data?: { specId?: string; config?: Record<string, unknown> };
}): AiKeyProvider | null {
  const specId = node.data?.specId ?? "";
  if (!isPremiumAiSpec(specId)) return null;
  return providerForAiSpec(specId, node.data?.config);
}

const PREMIUM_AI_CANONICAL = new Set(["llm-chat", "llm-embeddings", "llm-image", "condition"]);

/** Premium AI nodes (BYOK / platform keys), including legacy spec ids that canonicalize to these. */
export function isPremiumAiSpec(specId: string): boolean {
  if (!specId) return false;
  return PREMIUM_AI_CANONICAL.has(canonicalSpecId(specId));
}

/** @deprecated Use isPremiumAiSpec(specId) — supports legacy openai-* and removed claude/gemini chat ids. */
export const PREMIUM_AI_SPEC_IDS: string[] = [
  "llm-chat",
  "llm-embeddings",
  "llm-image",
  "openai-chat",
  "openai-embeddings",
  "openai-image",
  "condition",
];

/** Public path under /public for workflow node brand marks (uses model for unified llm-* nodes). */
export function brandIconPathForSpec(
  specId: string | undefined,
  config?: Record<string, unknown>,
): string | null {
  if (!specId) return null;
  const c = canonicalSpecId(specId);
  if (c === "llm-chat" || specId === "openai-chat") {
    if (specId === "openai-chat" || config?.[LEGACY_OPENAI_CHAT_CONFIG_FLAG] === true) {
      return "/misc/chatgpt-white.png";
    }
    const m = (config?.model as string) || DEFAULT_LLM_CHAT_MODEL;
    const p = resolveLlmChatProvider(m);
    if (p === "anthropic") return "/misc/claude.png";
    if (p === "google") return "/misc/gemini.png";
    return "/misc/chatgpt-white.png";
  }
  if (c === "llm-image" || specId === "openai-image") {
    if (specId === "openai-image" || config?.[LEGACY_OPENAI_IMAGE_CONFIG_FLAG] === true) {
      return "/misc/chatgpt-white.png";
    }
    const m = (config?.model as string) || DEFAULT_LLM_IMAGE_MODEL;
    const p = resolveLlmImageProvider(m);
    if (p === "google") return "/misc/gemini.png";
    return "/misc/chatgpt-white.png";
  }
  if (c === "llm-embeddings") return "/misc/chatgpt-white.png";
  if (c === "youtube-transcript") return "/misc/Youtube_logo.png";
  return null;
}
