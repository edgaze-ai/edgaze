// src/lib/workflow/token-counting.ts
/**
 * Token counting utilities for OpenAI API calls
 * Approximate token counting using a simple heuristic
 */

import { DEFAULT_MAX_TOKENS_PER_NODE, DEFAULT_MAX_TOKENS_PER_WORKFLOW } from "./token-limits";

// These are defaults - actual limits come from getTokenLimits()
const MAX_TOKENS_PER_NODE = DEFAULT_MAX_TOKENS_PER_NODE;
const MAX_TOKENS_PER_WORKFLOW = DEFAULT_MAX_TOKENS_PER_WORKFLOW;

/**
 * Approximate token count for text
 * Rough estimate: ~4 characters per token for English text
 * More accurate for OpenAI models
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  
  // Simple heuristic: ~4 chars per token for English
  // This is a conservative estimate
  const charCount = text.length;
  const estimatedTokens = Math.ceil(charCount / 4);
  
  return estimatedTokens;
}

/**
 * Count tokens in messages array (OpenAI chat format)
 */
export function countMessageTokens(messages: Array<{ role: string; content: string }>): number {
  if (!Array.isArray(messages)) return 0;
  
  let total = 0;
  for (const msg of messages) {
    if (msg.content && typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    }
    // Add overhead for role and message structure (~3 tokens per message)
    total += 3;
  }
  
  return total;
}

/**
 * Count tokens for OpenAI chat request
 */
export function countChatTokens(config: {
  prompt?: string;
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  maxTokens?: number;
}): { input: number; output: number; total: number } {
  let inputTokens = 0;
  
  if (config.messages && Array.isArray(config.messages)) {
    inputTokens = countMessageTokens(config.messages);
  } else {
    if (config.system) {
      inputTokens += estimateTokens(config.system);
    }
    if (config.prompt) {
      inputTokens += estimateTokens(config.prompt);
    }
  }
  
  // Output tokens (max_tokens setting)
  const outputTokens = config.maxTokens || 2000;
  
  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
  };
}

/**
 * Count tokens for embeddings request
 */
export function countEmbeddingTokens(text: string): number {
  return estimateTokens(text);
}

/**
 * Count tokens for image generation (DALL-E)
 * Image generation doesn't use tokens, but we count the prompt
 */
export function countImageTokens(prompt: string): number {
  return estimateTokens(prompt);
}

/**
 * Validate token limits for a node
 */
export function validateNodeTokenLimit(
  nodeId: string,
  tokenCount: number,
  nodeType: "chat" | "embeddings" | "image",
  maxTokensPerNode?: number
): { valid: boolean; error?: string } {
  const limit = maxTokensPerNode || MAX_TOKENS_PER_NODE;
  if (tokenCount > limit) {
    return {
      valid: false,
      error: `Token limit exceeded for node "${nodeId}". Maximum ${limit.toLocaleString()} tokens per node, but ${tokenCount.toLocaleString()} tokens would be used. Please reduce the input size or max_tokens setting.`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate token limits for entire workflow
 */
export function validateWorkflowTokenLimit(
  totalTokens: number,
  maxTokensPerWorkflow?: number
): { valid: boolean; error?: string } {
  const limit = maxTokensPerWorkflow || MAX_TOKENS_PER_WORKFLOW;
  if (totalTokens > limit) {
    return {
      valid: false,
      error: `Workflow token limit exceeded. Maximum ${limit.toLocaleString()} tokens per workflow, but ${totalTokens.toLocaleString()} tokens would be used. Please reduce the number of nodes or their token usage.`,
    };
  }
  
  return { valid: true };
}

export { MAX_TOKENS_PER_NODE, MAX_TOKENS_PER_WORKFLOW };
