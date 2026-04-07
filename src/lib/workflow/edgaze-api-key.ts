/**
 * Edgaze API Key Management
 * Strict rate limiting for demos and first N runs
 */

import geminiPlatformEnvVarNames from "./gemini-platform-env-var-names.json";

function trimEnvKey(v: string | undefined): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : undefined;
}

/**
 * Read deployment/runtime secrets without static `process.env.NAME` patterns.
 * Next/SWC may inline those at build time as `undefined` when vars exist only on the
 * hosting provider at runtime (e.g. Vercel Production env not present during `next build`).
 */
function readProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const env = process.env as Record<string, string | undefined>;
  return env[name];
}

let warnedOpenai = false;
let warnedAnthropic = false;
let geminiPlatformKeyWarned = false;

/** Read on each access so serverless/runtime env matches deployment (see gemini-platform-env-var-names.json). */
function readGeminiPlatformKey(): string | undefined {
  for (const name of geminiPlatformEnvVarNames.names) {
    const t = trimEnvKey(readProcessEnv(name));
    if (t) return t;
  }
  if (!geminiPlatformKeyWarned) {
    geminiPlatformKeyWarned = true;
    const hint = geminiPlatformEnvVarNames.names.join(", ");
    console.warn(
      `No platform Gemini key; set one of: ${hint}. Platform Gemini runs will not work.`,
    );
  }
  return undefined;
}

/**
 * Get Edgaze OpenAI API key (LLM Chat / Image / Embeddings via OpenAI).
 */
export function getEdgazeApiKey(): string | null {
  const key = trimEnvKey(readProcessEnv("EDGAZE_OPENAI_API_KEY"));
  if (!key && !warnedOpenai) {
    warnedOpenai = true;
    console.warn("EDGAZE_OPENAI_API_KEY not set. Edgaze-funded runs will not work.");
  }
  return key ?? null;
}

export function hasEdgazeApiKey(): boolean {
  return !!trimEnvKey(readProcessEnv("EDGAZE_OPENAI_API_KEY"));
}

export function getEdgazeAnthropicApiKey(): string | null {
  const key = trimEnvKey(readProcessEnv("EDGAZE_ANTHROPIC_API_KEY"));
  if (!key && !warnedAnthropic) {
    warnedAnthropic = true;
    console.warn("EDGAZE_ANTHROPIC_API_KEY not set. Platform Claude runs will not work.");
  }
  return key ?? null;
}

export function hasEdgazeAnthropicApiKey(): boolean {
  return !!trimEnvKey(readProcessEnv("EDGAZE_ANTHROPIC_API_KEY"));
}

export function getEdgazeGeminiApiKey(): string | null {
  return readGeminiPlatformKey() ?? null;
}

export function hasEdgazeGeminiApiKey(): boolean {
  return !!readGeminiPlatformKey();
}
