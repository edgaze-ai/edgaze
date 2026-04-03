/**
 * Edgaze API Key Management
 * Strict rate limiting for demos and first N runs
 */

function trimEnvKey(v: string | undefined): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : undefined;
}

const EDGAZE_OPENAI_API_KEY = trimEnvKey(process.env.EDGAZE_OPENAI_API_KEY);
const EDGAZE_ANTHROPIC_API_KEY = trimEnvKey(process.env.EDGAZE_ANTHROPIC_API_KEY);
const EDGAZE_GEMINI_API_KEY = trimEnvKey(process.env.EDGAZE_GEMINI_API_KEY);

if (!EDGAZE_OPENAI_API_KEY) {
  console.warn("EDGAZE_OPENAI_API_KEY not set. Edgaze-funded runs will not work.");
}
if (!EDGAZE_ANTHROPIC_API_KEY) {
  console.warn("EDGAZE_ANTHROPIC_API_KEY not set. Platform Claude runs will not work.");
}
if (!EDGAZE_GEMINI_API_KEY) {
  console.warn("EDGAZE_GEMINI_API_KEY not set. Platform Gemini runs will not work.");
}

/**
 * Get Edgaze OpenAI API key (LLM Chat / Image / Embeddings via OpenAI).
 */
export function getEdgazeApiKey(): string | null {
  return EDGAZE_OPENAI_API_KEY || null;
}

export function hasEdgazeApiKey(): boolean {
  return !!EDGAZE_OPENAI_API_KEY;
}

export function getEdgazeAnthropicApiKey(): string | null {
  return EDGAZE_ANTHROPIC_API_KEY || null;
}

export function hasEdgazeAnthropicApiKey(): boolean {
  return !!EDGAZE_ANTHROPIC_API_KEY;
}

export function getEdgazeGeminiApiKey(): string | null {
  return EDGAZE_GEMINI_API_KEY || null;
}

export function hasEdgazeGeminiApiKey(): boolean {
  return !!EDGAZE_GEMINI_API_KEY;
}
