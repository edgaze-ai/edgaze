// src/lib/workflow/edgaze-api-key.ts
/**
 * Edgaze API Key Management
 * Strict rate limiting for demos and first 10 runs
 */

const EDGAZE_OPENAI_API_KEY = process.env.EDGAZE_OPENAI_API_KEY;

if (!EDGAZE_OPENAI_API_KEY) {
  console.warn("EDGAZE_OPENAI_API_KEY not set. Edgaze-funded runs will not work.");
}

/**
 * Get Edgaze OpenAI API key
 * Only use for:
 * - One-time demos on product pages
 * - First 10 runs after purchase
 */
export function getEdgazeApiKey(): string | null {
  return EDGAZE_OPENAI_API_KEY || null;
}

/**
 * Check if Edgaze API key is available
 */
export function hasEdgazeApiKey(): boolean {
  return !!EDGAZE_OPENAI_API_KEY;
}
