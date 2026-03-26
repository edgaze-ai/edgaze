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

export type { AiKeyProvider } from "./llm-model-catalog";

export const LEGACY_TO_CANONICAL: Record<string, string> = {
  "openai-chat": "llm-chat",
  "openai-embeddings": "llm-embeddings",
  "openai-image": "llm-image",
};

export function canonicalSpecId(specId: string): string {
  return LEGACY_TO_CANONICAL[specId] ?? specId;
}

/** All spec IDs that count as AI/premium key consumers (includes legacy aliases). */
export const AI_LLM_CHAT_SPECS = new Set(["llm-chat", "openai-chat", "claude-chat", "gemini-chat"]);

export const AI_EMBEDDING_SPECS = new Set(["llm-embeddings", "openai-embeddings"]);

export const AI_IMAGE_SPECS = new Set(["llm-image", "openai-image"]);

export function isAiChatSpec(specId: string): boolean {
  return AI_LLM_CHAT_SPECS.has(specId);
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
    const m = (config?.model as string) || DEFAULT_LLM_CHAT_MODEL;
    return resolveLlmChatProvider(m);
  }
  if (c === "llm-image" || specId === "openai-image") {
    const m = (config?.model as string) || DEFAULT_LLM_IMAGE_MODEL;
    return resolveLlmImageProvider(m);
  }
  if (c === "llm-embeddings" || specId === "openai-embeddings") return "openai";
  if (specId === "claude-chat") return "anthropic";
  if (specId === "gemini-chat") return "google";
  return "openai";
}

/** Premium AI node → API key provider (null if not a premium AI spec). */
export function resolvePremiumKeyProvider(node: {
  data?: { specId?: string; config?: Record<string, unknown> };
}): AiKeyProvider | null {
  const specId = node.data?.specId ?? "";
  if (!PREMIUM_AI_SPEC_IDS.includes(specId)) return null;
  return providerForAiSpec(specId, node.data?.config);
}

/** Premium node types that may need API keys (excluding http-request). */
export const PREMIUM_AI_SPEC_IDS: string[] = [
  "llm-chat",
  "llm-embeddings",
  "llm-image",
  "openai-chat",
  "openai-embeddings",
  "openai-image",
  "claude-chat",
  "gemini-chat",
];

/** Public path under /public for workflow node brand marks (uses model for unified llm-* nodes). */
export function brandIconPathForSpec(
  specId: string | undefined,
  config?: Record<string, unknown>,
): string | null {
  if (!specId) return null;
  const c = canonicalSpecId(specId);
  if (c === "claude-chat") return "/misc/claude.png";
  if (c === "gemini-chat") return "/misc/gemini.png";
  if (c === "llm-chat" || specId === "openai-chat") {
    const m = (config?.model as string) || DEFAULT_LLM_CHAT_MODEL;
    const p = resolveLlmChatProvider(m);
    if (p === "anthropic") return "/misc/claude.png";
    if (p === "google") return "/misc/gemini.png";
    return "/misc/chatgpt-white.png";
  }
  if (c === "llm-image" || specId === "openai-image") {
    const m = (config?.model as string) || DEFAULT_LLM_IMAGE_MODEL;
    const p = resolveLlmImageProvider(m);
    if (p === "google") return "/misc/gemini.png";
    return "/misc/chatgpt-white.png";
  }
  if (c === "llm-embeddings") return "/misc/chatgpt-white.png";
  return null;
}
