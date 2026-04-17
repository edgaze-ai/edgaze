import { containsAny } from "@/lib/security/safe-values";

/**
 * Human-readable error messages for workflow runs.
 * Never show technical jargon or raw API errors to users.
 */

export function simplifyWorkflowError(error: string | unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const e = raw.trim();
  if (!e) return "Something went wrong. Try again.";
  const cleaned = e.replace(/^Error:\s*/i, "").trim();
  const first = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;

  // Image / limit verification – keep full message so user knows the cause
  if (
    e.includes("Image limit check") ||
    e.includes("image generation limits") ||
    e.includes("Unable to verify image generation")
  ) {
    return e;
  }

  // API key
  const el = e.toLowerCase();
  if (
    containsAny(el, ["401", "authentication", "unauthorized", "incorrect api key"]) ||
    (el.includes("invalid") && el.includes("api") && el.includes("key"))
  ) {
    if (el.includes("openai")) {
      return "OpenAI rejected the API key for this node. Add or update the OpenAI key in the run modal or node settings.";
    }
    if (el.includes("anthropic")) {
      return "Anthropic rejected the API key for this node. Add or update the Anthropic key in the run modal or node settings.";
    }
    if (el.includes("gemini") || el.includes("google")) {
      return "Google/Gemini rejected the API key for this node. Add or update the Gemini key in the run modal or node settings.";
    }
    return "The API key for a workflow node is invalid or expired. Add or update the matching provider key in the run modal or node settings.";
  }
  if (e.includes("API key required") || e.includes("API key is required")) {
    return first.length > 180 ? first.slice(0, 177) + "..." : first;
  }

  // Rate limits
  if (containsAny(el, ["rate limit", "429", "too many requests"])) {
    return "Too many requests right now. Wait a moment and try again.";
  }

  // Token / context limits
  if (
    containsAny(el, [
      "token limit",
      "context length",
      "maximum context length",
      "context_length_exceeded",
    ])
  ) {
    return "The input or output is too long. Try shorter text or fewer items.";
  }
  if (e.includes("Token limit exceeded")) {
    return "The workflow uses too many tokens. Try reducing your inputs or prompts.";
  }

  // Content / safety
  if (containsAny(el, ["content filter", "content_policy", "safety", "policy"])) {
    return "The content was blocked by safety filters. Try rephrasing or using different input.";
  }

  // Model / request
  if (
    el.includes("invalid_request") ||
    el.includes("invalid request") ||
    e.includes("404") ||
    el.includes("bad request") ||
    (el.includes("model") && el.includes("not found"))
  ) {
    return "The request was invalid. Check the model name and node settings.";
  }
  if (e.includes("Prompt or messages array required")) {
    return "The AI chat node needs a prompt. Connect an input node or add a prompt in the node.";
  }
  if (e.includes("Prompt required for image generation")) {
    return "The image node needs a prompt. Connect an input or add a prompt.";
  }
  if (e.includes("Text input required for embeddings")) {
    return "The embeddings node needs text input. Connect an input node.";
  }

  // Server / timeout / network
  if (
    containsAny(el, [
      "timeout",
      "timed out",
      "etimedout",
      "econnrefused",
      "enotfound",
      "fetch failed",
    ])
  ) {
    return "The request took too long or couldn't connect. Try again in a moment.";
  }
  if (containsAny(el, ["500", "server error", "internal error", "502", "503"])) {
    return "The AI service had a temporary problem. Try again in a moment.";
  }

  // HTTP / response
  if (el.includes("response too large") || (el.includes("exceeds") && el.includes("bytes"))) {
    return "The response was too large. Try smaller inputs or a simpler request.";
  }
  if (/invalid json|invalid JSON/i.test(e)) {
    return "Invalid data was returned. Try again or check your inputs.";
  }

  // Workflow runner / claim RPC (durable v2)
  if (
    (el.includes("stayed idle for") && el.includes("consecutive cycles")) ||
    el.includes("exceeded the worker iteration limit") ||
    el.includes("runner_stalled")
  ) {
    return "The workflow engine could not start or pick up steps. Apply pending Supabase migrations (including claim_workflow_run_node_attempt), restart the app, and try again.";
  }

  // Workflow / nodes
  if (e.includes("Invalid node transition")) {
    return "A step failed unexpectedly. Check that all required inputs are connected.";
  }
  if (e.includes("URL required") || e.includes("URL validation")) {
    return "A valid URL is required. Check the HTTP node configuration.";
  }
  if (e.includes("free runs") || e.includes("5 free runs")) {
    return "You've used all your free runs. Add your API key or purchase to continue.";
  }
  if (e.includes("Loop input must be an array")) {
    return "The loop node needs an array as input. Connect a node that outputs a list.";
  }
  if (e.includes("Map input must be an array")) {
    return "The map node needs an array as input. Connect a node that outputs a list.";
  }

  // Execution / generic
  if (["execution failed", "run failed", "cancelled"].includes(cleaned.toLowerCase())) {
    return "The workflow run failed. Try again or check your setup.";
  }

  // If it still looks technical (has error codes, stack traces, etc), use generic message
  if (
    first.startsWith("[object") ||
    first.includes(".ts:") ||
    first.includes(".js:") ||
    first.includes(" at ") ||
    first.includes("Error:")
  ) {
    return "Something went wrong. Try again.";
  }

  return first.length > 140 ? first.slice(0, 137) + "…" : first;
}
