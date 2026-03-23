/**
 * Human-readable error messages for workflow runs.
 * Never show technical jargon or raw API errors to users.
 */

export function simplifyWorkflowError(error: string | unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const e = raw.trim();
  if (!e) return "Something went wrong. Try again.";

  // Image / limit verification – keep full message so user knows the cause
  if (
    e.includes("Image limit check") ||
    e.includes("image generation limits") ||
    e.includes("Unable to verify image generation")
  ) {
    return e;
  }

  // API key
  if (
    /invalid.*api.*key|incorrect API key|401|authentication|unauthorized/i.test(e)
  ) {
    return "The API key is invalid or expired. Add or update your key in the run modal or node settings.";
  }
  if (e.includes("API key required") || e.includes("API key is required")) {
    return "An API key is needed to run this workflow. Add your key in the run modal.";
  }

  // Rate limits
  if (/rate limit|429|too many requests/i.test(e)) {
    return "Too many requests right now. Wait a moment and try again.";
  }

  // Token / context limits
  if (
    /token limit|context length|maximum context length|context_length_exceeded/i.test(e)
  ) {
    return "The input or output is too long. Try shorter text or fewer items.";
  }
  if (e.includes("Token limit exceeded")) {
    return "The workflow uses too many tokens. Try reducing your inputs or prompts.";
  }

  // Content / safety
  if (/content filter|content_policy|safety|policy/i.test(e)) {
    return "The content was blocked by safety filters. Try rephrasing or using different input.";
  }

  // Model / request
  if (
    /invalid_request|invalid request|model.*not found|404|bad request/i.test(e)
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
  if (/timeout|timed out|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(e)) {
    return "The request took too long or couldn't connect. Try again in a moment.";
  }
  if (/500|server error|internal error|502|503/i.test(e)) {
    return "The AI service had a temporary problem. Try again in a moment.";
  }

  // HTTP / response
  if (/response too large|exceeds.*bytes/i.test(e)) {
    return "The response was too large. Try smaller inputs or a simpler request.";
  }
  if (/invalid json|invalid JSON/i.test(e)) {
    return "Invalid data was returned. Try again or check your inputs.";
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
  if (/execution failed|run failed|cancelled/i.test(e)) {
    return "The workflow run failed. Try again or check your setup.";
  }

  // Fallback: strip "Error:" prefix, take first sentence, cap length
  const cleaned = e.replace(/^Error:\s*/i, "").trim();
  const first = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;

  // If it still looks technical (has error codes, stack traces, etc), use generic message
  if (
    /^[A-Za-z]+Error:|^\[object|:\d+:\d+|at\s+\w+\.|\.ts:\d|\.js:\d/i.test(first)
  ) {
    return "Something went wrong. Try again.";
  }
  if (first.includes("OpenAI API error:") || first.includes("OpenAI")) {
    return "The AI service returned an error. Try again or check your API key.";
  }

  return first.length > 140 ? first.slice(0, 137) + "…" : first;
}
