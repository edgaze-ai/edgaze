// src/nodes/nodeSearch.ts
// Non-LLM natural-language node search: maps user instructions to block library nodes.
// Always returns an English message and suggested nodes.

import type { NodeSpec } from "./types";
import { listNodeSpecs } from "./registry";

const STOPWORDS = new Set(
  "i me my we our you your want need to the a an and or but for of in on at is are was were be been being have has had do does did will would could should can may might must shall".split(
    " "
  )
);

/** Expand common phrases/words to extra search terms (no LLM). */
const QUERY_SYNONYMS: Record<string, string[]> = {
  email: ["email", "send", "message", "mail", "smtp", "http", "request"],
  image: ["image", "picture", "photo", "generate", "dall-e", "openai", "draw"],
  picture: ["image", "picture", "photo", "openai-image"],
  photo: ["image", "picture", "photo", "openai-image"],
  api: ["http", "request", "fetch", "url", "call", "endpoint"],
  request: ["http", "request", "fetch", "api"],
  fetch: ["http", "request", "fetch"],
  merge: ["merge", "combine", "join", "unify"],
  combine: ["merge", "combine", "join"],
  condition: ["condition", "if", "branch", "switch", "check", "decide"],
  if: ["condition", "branch", "switch"],
  branch: ["condition", "branch"],
  loop: ["loop", "iterate", "foreach", "repeat", "each"],
  iterate: ["loop", "iterate", "foreach"],
  delay: ["delay", "wait", "sleep", "pause"],
  wait: ["delay", "wait", "sleep"],
  json: ["json", "parse", "object", "parse"],
  parse: ["json", "json-parse", "parse"],
  input: ["input", "start", "entry", "workflow input"],
  output: ["output", "result", "final", "workflow output"],
  result: ["output", "result"],
  chat: ["chat", "gpt", "openai", "text", "completion", "openai-chat"],
  gpt: ["openai", "chat", "gpt", "openai-chat"],
  ai: ["openai", "chat", "embedding", "image", "ai"],
  embed: ["embedding", "embed", "vector", "openai-embeddings"],
  vector: ["embedding", "vector", "openai-embeddings"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function expandTerms(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    const syn = QUERY_SYNONYMS[t];
    if (syn) syn.forEach((s) => out.add(s));
  }
  return out;
}

function searchableText(spec: NodeSpec): string {
  return [
    spec.label,
    spec.id,
    spec.summary ?? "",
    spec.category,
    ...(spec.inspector ?? []).flatMap((f) =>
      "label" in f ? [f.label] : []
    ),
  ]
    .join(" ")
    .toLowerCase();
}

export type NodeSearchResult = {
  suggestions: NodeSpec[];
  message: string;
};

const MAX_SUGGESTIONS = 8;

/**
 * Match natural-language instruction to block library nodes (no LLM).
 * Returns suggested nodes and an English message.
 */
export function matchNodesFromNaturalLanguage(
  query: string,
  specs: NodeSpec[] = listNodeSpecs()
): NodeSearchResult {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return {
      suggestions: [],
      message: "Enter a short instruction (e.g. “generate an image” or “call an API”) and I’ll suggest matching nodes.",
    };
  }

  const tokens = tokenize(trimmed);
  const terms = expandTerms(tokens);
  const phrase = trimmed.toLowerCase();

  const scored = specs.map((spec) => {
    const text = searchableText(spec);
    let score = 0;
    // Phrase contained in searchable text (strong match)
    if (text.includes(phrase)) score += 20;
    // Each query token (or synonym) found
    for (const term of terms) {
      if (text.includes(term)) score += 5;
      if (spec.id.toLowerCase().includes(term)) score += 3;
      if (spec.label.toLowerCase().includes(term)) score += 4;
    }
    return { spec, score };
  });

  const filtered = scored.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  const suggestions = filtered.slice(0, MAX_SUGGESTIONS).map((e) => e.spec);

  if (suggestions.length === 0) {
    return {
      suggestions: [],
      message: `I couldn’t find any nodes that match “${trimmed}”. Try phrases like “generate image”, “HTTP request”, “merge data”, or “condition branch”.`,
    };
  }

  const names = suggestions.map((s) => s.label).join(", ");
  const count = suggestions.length;
  const message =
    count === 1
      ? `Here’s a node that matches your request: ${names}.`
      : `Here are ${count} nodes that match your request: ${names}.`;

  return { suggestions, message };
}
