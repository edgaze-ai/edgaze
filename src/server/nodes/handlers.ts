import type { GraphNode, NodeRuntimeHandler, RuntimeContext } from "../flow/types";
import {
  countChatTokens,
  countEmbeddingTokens,
  countImageTokens,
  validateNodeTokenLimit,
} from "../../lib/workflow/token-counting";
import {
  stripSensitiveHeaders,
  validateUrlForWorkflow,
  resolveAndValidateHostnameIp,
  MAX_HTTP_RESPONSE_BYTES,
  MAX_JSON_DEPTH,
  exceedsJsonDepth,
} from "@lib/workflow/domain-allowlist";
import {
  checkProviderRateLimit,
  recordProviderUsage,
  record429Cooldown,
} from "@lib/workflow/provider-rate-limits";
import { getTokenLimits } from "../../lib/workflow/token-limits";
import {
  checkImageGenerationAllowed,
  recordImageGeneration,
} from "../../lib/rate-limiting/image-generation";
import {
  buildConditionEvaluationInstruction,
  evaluateConditionWithAI,
} from "../../lib/ai/condition-evaluator";
import {
  canonicalSpecId,
  isOpenAiBackedSpec,
  LEGACY_OPENAI_CHAT_CONFIG_FLAG,
  LEGACY_OPENAI_IMAGE_CONFIG_FLAG,
} from "../../lib/workflow/spec-id-aliases";
import {
  DEFAULT_LLM_CHAT_MODEL,
  DEFAULT_LLM_IMAGE_MODEL,
  DEFAULT_LLM_IMAGE_TIMEOUT_MS,
  LEGACY_OPENAI_CHAT_MODEL,
  LEGACY_OPENAI_IMAGE_MODEL,
  openaiChatUsesMaxCompletionTokens,
  openaiGptImageQualityParam,
  openaiImagePixelSizeFromAspectRatio,
  resolveAnthropicApiModel,
  resolveLlmChatProvider,
  resolveLlmImageAspectRatio,
  resolveLlmImageProvider,
} from "../../lib/workflow/llm-model-catalog";
import { getEdgazeGeminiApiKey } from "../../lib/workflow/edgaze-api-key";

/** Hosted run: resolve Gemini from env when per-node __api_key_* injection is missing (handoff / reload). */
function hostedGeminiKeyFromRunInputs(ctx: RuntimeContext): string | null {
  const inputs = ctx.inputs as Record<string, unknown> | undefined;
  if (inputs?.["__platform_fund_gemini"] !== true) return null;
  return getEdgazeGeminiApiKey();
}

/**
 * Safely convert any value to a displayable string.
 * Objects get JSON.stringify'd (with content extraction for known shapes like OpenAI results).
 * Never returns "[object Object]".
 */
export function safeToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;

    // Extract content from known API response shapes (OpenAI { content, model, usage }, etc.)
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.output === "string") return obj.output;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.response === "string") return obj.response;
    if (typeof obj.answer === "string") return obj.answer;
    if (typeof obj.prompt === "string") return obj.prompt;

    // Input node shape { value, question }
    if ("question" in obj && "value" in obj) {
      return obj.value === undefined || obj.value === null
        ? ""
        : typeof obj.value === "string"
          ? obj.value
          : safeToString(obj.value);
    }

    // Condition passthrough: extract the wrapped value
    if (CONDITION_RESULT_KEY in obj && CONDITION_PASSTHROUGH_KEY in obj) {
      return safeToString(obj[CONDITION_PASSTHROUGH_KEY]);
    }

    if (Array.isArray(v)) {
      return v.map((item) => safeToString(item)).join(" ");
    }

    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "[complex object]";
    }
  }

  return String(v);
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw abortError("Operation aborted");
}

function createTimeoutAbortController(timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const handleParentAbort = () => {
    controller.abort(parentSignal?.reason ?? abortError("Operation aborted"));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      handleParentAbort();
    } else {
      parentSignal.addEventListener("abort", handleParentAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(
    () => controller.abort(abortError("Operation timed out")),
    timeoutMs,
  );

  return {
    controller,
    dispose() {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", handleParentAbort);
      }
    },
  };
}

function formatRemoteImageGenerationError(err: unknown): Error {
  if (err instanceof Error && err.name === "AbortError") {
    return new Error("Image generation timeout");
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function waitWithAbort(durationMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, durationMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason instanceof Error ? signal.reason : abortError("Operation aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const inputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Input node: accepts workflow-level input data
  const external = ctx.inputs?.[node.id];

  // Resolve the actual value: external input (string or object e.g. file), then config fallback
  let value: unknown;
  if (external !== undefined && external !== null) {
    value = external;
  } else {
    const configValue =
      node.data?.config?.value ?? node.data?.config?.text ?? node.data?.config?.defaultValue;
    value =
      configValue !== undefined && configValue !== null && configValue !== "" ? configValue : "";
  }

  const question =
    typeof node.data?.config?.question === "string" ? node.data.config.question.trim() : undefined;

  // When question is set, output { value, question } so OpenAI can show "Question / Answer" in an Inputs section
  if (question && question.length > 0) {
    const output = { value, question };
    ctx.setNodeOutput(node.id, output);
    return output;
  }

  ctx.setNodeOutput(node.id, value);
  return value;
};

const mergeHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Merge node: combines multiple inputs intelligently
  // This node receives outputs from previous nodes (like ChatGPT) and combines them
  const inbound = ctx.getInboundValues(node.id);

  console.warn(
    `[Merge Node ${node.id}] Received inbound values:`,
    inbound.map((v) => ({
      type: typeof v,
      isArray: Array.isArray(v),
      preview:
        typeof v === "string"
          ? v.substring(0, 50)
          : Array.isArray(v)
            ? `Array[${v.length}]`
            : typeof v === "object"
              ? "Object"
              : String(v),
    })),
  );

  // Filter out only null/undefined (preserve empty strings, 0, false, etc. - let downstream nodes decide)
  const valid = inbound.filter((v) => v !== null && v !== undefined);

  // If no valid inputs at all, return empty string (not null) so downstream nodes can detect it
  if (valid.length === 0) {
    console.warn(`[Merge Node ${node.id}] No valid inputs, returning empty string`);
    ctx.setNodeOutput(node.id, "");
    return "";
  }

  // Helper: convert one value to string for merging (handles condition passthrough, input node { value, question }, etc.)
  const toMergeString = (v: unknown): string => {
    return safeToString(extractPipelineContent(v));
  };

  // If only one input, pass it through directly (no merging needed)
  if (valid.length === 1) {
    const single = valid[0];
    const output = toMergeString(single);
    console.warn(
      `[Merge Node ${node.id}] Single input, passing through:`,
      output.substring(0, 100),
    );
    ctx.setNodeOutput(node.id, output);
    return output;
  }

  // Multiple inputs: merge all into one string (do not drop any input)
  const stringInputs = valid.map((v) => toMergeString(v));
  const merged = stringInputs.join("\n\n");
  console.warn(
    `[Merge Node ${node.id}] Merged ${valid.length} inputs into string:`,
    merged.substring(0, 100),
  );
  ctx.setNodeOutput(node.id, merged);
  return merged;
};

/**
 * Normalize any value into a clean displayable output.
 * Deep-traverses objects to extract meaningful text content.
 * This is the last line of defense — it should NEVER return an opaque object or "[object Object]".
 */
export function normalizeToDisplayable(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return v;

  if (Array.isArray(v)) {
    // Array of strings: join them
    if (v.every((item) => typeof item === "string")) return v.join("\n\n");
    // Array of objects: normalize each
    const normalized = v.map(normalizeToDisplayable);
    if (normalized.every((item) => typeof item === "string")) {
      return (normalized as string[]).join("\n\n");
    }
    return normalized;
  }

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;

    // Input node shape { value, question } — unwrap before anything else
    if ("value" in obj && "question" in obj) {
      return normalizeToDisplayable(obj.value);
    }

    // Condition passthrough shape
    if (CONDITION_RESULT_KEY in obj && CONDITION_PASSTHROUGH_KEY in obj) {
      return normalizeToDisplayable(obj[CONDITION_PASSTHROUGH_KEY]);
    }

    // Try extracting from known shapes (prioritized)
    for (const key of [
      "content",
      "text",
      "output",
      "message",
      "value",
      "result",
      "response",
      "answer",
      "reply",
      "body",
      "summary",
      "data",
    ]) {
      const val = obj[key];
      if (typeof val === "string" && val.trim()) return val;
    }

    // Nested: { message: { content: "..." } }
    if (obj.message && typeof obj.message === "object") {
      const inner = normalizeToDisplayable(obj.message);
      if (typeof inner === "string" && inner.trim()) return inner;
    }

    // { choices: [{ message: { content: "..." }}] } — OpenAI response shape
    if (Array.isArray(obj.choices) && obj.choices[0]) {
      const c0 = obj.choices[0] as Record<string, unknown>;
      const msg = c0?.message as Record<string, unknown> | undefined;
      if (typeof msg?.content === "string") return msg.content;
      if (typeof c0?.text === "string") return c0.text;
    }

    // { results: ["...", "..."] }
    if (Array.isArray(obj.results)) {
      const inner = normalizeToDisplayable(obj.results);
      if (typeof inner === "string" && inner.trim()) return inner;
    }

    // Last resort: find ANY string value in the top-level keys (skip metadata)
    const SKIP_KEYS = new Set([
      "model",
      "usage",
      "id",
      "object",
      "created",
      "system_fingerprint",
      "finish_reason",
      "finishReason",
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
      "timestamp",
      "count",
    ]);
    for (const [key, val] of Object.entries(obj)) {
      if (SKIP_KEYS.has(key)) continue;
      if (typeof val === "string" && val.trim()) return val;
    }

    // Truly opaque object: JSON.stringify so the user at least sees the data
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "[complex result]";
    }
  }

  return String(v);
}

const outputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const inbound = ctx.getInboundValues(node.id);

  const valid = inbound
    .filter((v) => v !== undefined && v !== null)
    .map((v) => extractPipelineContent(v));

  if (valid.length === 0) {
    ctx.setNodeOutput(node.id, null);
    return null;
  }

  if (valid.length === 1) {
    const output = normalizeToDisplayable(valid[0]);
    ctx.setNodeOutput(node.id, output);
    return output;
  }

  // Multiple inputs: always normalize each value and merge as text
  const parts = valid.map((v) => {
    const normalized = normalizeToDisplayable(v);
    return typeof normalized === "string" ? normalized : safeToString(normalized);
  });
  const merged = parts.filter((p) => p.trim()).join("\n\n");
  ctx.setNodeOutput(node.id, merged);
  return merged;
};

// Premium Node Handlers

function isLegacyOpenAiChatNode(node: GraphNode): boolean {
  const specId = node.data?.specId ?? "";
  if (specId === "openai-chat") return true;
  return node.data?.config?.[LEGACY_OPENAI_CHAT_CONFIG_FLAG] === true;
}

function isLegacyOpenAiImageNode(node: GraphNode): boolean {
  const specId = node.data?.specId ?? "";
  if (specId === "openai-image") return true;
  return node.data?.config?.[LEGACY_OPENAI_IMAGE_CONFIG_FLAG] === true;
}

const getApiKey = (node: GraphNode, ctx: RuntimeContext): string | null => {
  // First check if API key is provided via inputs (from run modal or Edgaze)
  const key = ctx.inputs?.[`__api_key_${node.id}`];
  if (typeof key === "string" && key.trim()) return key.trim();

  // Fallback: check node config (stored in inspector - user's own key)
  const configKey = node.data?.config?.apiKey;
  if (typeof configKey === "string" && configKey.trim()) return configKey.trim();

  return null;
};

/**
 * Check if the API key being used is the user's own key (not Edgaze's)
 */
const isUserProvidedApiKey = (node: GraphNode, ctx: RuntimeContext): boolean => {
  const inputs = ctx.inputs as Record<string, unknown> | undefined;
  const specId = node.data?.specId ?? "";
  const canon = canonicalSpecId(specId);
  const config = node.data?.config ?? {};

  if (canon === "llm-chat" || specId === "openai-chat") {
    const legacy = specId === "openai-chat" || config[LEGACY_OPENAI_CHAT_CONFIG_FLAG] === true;
    const m = legacy
      ? LEGACY_OPENAI_CHAT_MODEL
      : (config.model as string) || DEFAULT_LLM_CHAT_MODEL;
    const p = resolveLlmChatProvider(m);
    if (p === "openai" && inputs?.["__builder_user_key_openai"]) return true;
    if (p === "anthropic" && inputs?.["__builder_user_key_anthropic"]) return true;
    if (p === "google" && inputs?.["__builder_user_key_gemini"]) return true;
  } else if (canon === "llm-image" || specId === "openai-image") {
    const legacy = specId === "openai-image" || config[LEGACY_OPENAI_IMAGE_CONFIG_FLAG] === true;
    const m = legacy
      ? LEGACY_OPENAI_IMAGE_MODEL
      : (config.model as string) || DEFAULT_LLM_IMAGE_MODEL;
    const p = resolveLlmImageProvider(m);
    if (p === "openai" && inputs?.["__builder_user_key_openai"]) return true;
    if (p === "google" && inputs?.["__builder_user_key_gemini"]) return true;
  } else {
    if (inputs?.["__builder_user_key"]) return true;
    if (inputs?.["__builder_user_key_openai"] && isOpenAiBackedSpec(specId)) return true;
  }

  const configKey = node.data?.config?.apiKey;
  if (typeof configKey === "string" && configKey.trim().length > 0) {
    return true;
  }

  return false;
};

/** Shared inbound → prompt/messages + Edgaze system prompt for unified LLM Chat. */
function buildWorkflowChatPromptParts(
  node: GraphNode,
  ctx: RuntimeContext,
  config: Record<string, unknown>,
) {
  const inbound = ctx.getInboundValues(node.id);

  let inboundMessages: any[] | undefined = undefined;

  for (const val of inbound) {
    if (val === null || val === undefined) continue;
    const content = extractPipelineContent(val);

    if (Array.isArray(content) && content.length > 0) {
      if (
        content.every(
          (item: any) => item && typeof item === "object" && ("role" in item || "content" in item),
        )
      ) {
        inboundMessages = content;
        break;
      }
    }

    if (
      typeof content === "object" &&
      !Array.isArray(content) &&
      Array.isArray((content as any).messages)
    ) {
      inboundMessages = (content as any).messages;
      break;
    }
  }

  const configPrompt =
    typeof config.prompt === "string" ? config.prompt.trim() || undefined : undefined;

  const oneInboundToInputSegment = (val: unknown): string => {
    return safeToString(extractPipelineContent(val));
  };

  let prompt: string | undefined;
  if (!inboundMessages && inbound.length > 0) {
    const validInbound = inbound.filter((v) => v !== null && v !== undefined);
    const segments = validInbound
      .map(oneInboundToInputSegment)
      .filter((s) => s.length > 0 || validInbound.length === 1);
    const inputsSection = segments.join("\n\n");
    if (inputsSection) {
      prompt = configPrompt
        ? `## Inputs\n\n${inputsSection}\n\n## Prompt\n\n${configPrompt}`
        : `## Inputs\n\n${inputsSection}`;
    } else {
      prompt = configPrompt;
    }
  } else {
    prompt = configPrompt;
  }

  const userSystem =
    typeof config.system === "string" ? config.system.trim() || undefined : undefined;
  const messages = inboundMessages;

  const outputFormatRules = `CRITICAL - Output format rules (you MUST follow these):
1. Respond ONLY with plain text or markdown. Start your response with the actual content immediately.
2. NEVER wrap your response in JSON like {"response": "..."}, {"answer": "..."}, {"result": "..."}, or any object/array structure — unless the user's prompt EXPLICITLY asks for JSON output.
3. NEVER wrap your response in code blocks (\`\`\`) unless the user EXPLICITLY asked for code.
4. NEVER prefix your response with labels like "Response:", "Answer:", "Output:", "Here is", "Sure!", etc.
5. If the user asks you to write an email, letter, or document — output the content directly, not wrapped in any structure.
6. Output EXACTLY the requested content so it displays correctly in the workflow pipeline. Nothing more, nothing less.`;

  const basePrompt = `You are a precise AI assistant running inside an automated Edgaze workflow pipeline. Your output is displayed directly to end users — it must be clean, complete, and ready to use.

Rules:
- Be concise and accurate. Follow user instructions exactly.
- Do not echo, repeat, or summarize the input values. Just produce the requested output.
- Do not add commentary about what you're doing. Just output the result.
- If the input is unclear or empty, produce the best output you can from the context available.`;

  const serverSystemPrompt = process.env.EDGAZE_SERVER_SYSTEM_PROMPT
    ? `${process.env.EDGAZE_SERVER_SYSTEM_PROMPT.trim()}\n\n${basePrompt}\n\n${outputFormatRules}`
    : `${basePrompt}\n\n${outputFormatRules}`;

  const system = userSystem
    ? `${serverSystemPrompt}\n\nUser context: ${userSystem}`
    : serverSystemPrompt;

  if (prompt === undefined && system) {
    prompt = "";
  }

  if (prompt === undefined && !messages) {
    if (inbound.length === 0) {
      throw new Error(
        "Prompt or messages array required. Please provide a prompt in the node configuration or connect an input node with data.",
      );
    }
    const anyConfig =
      (typeof config.prompt === "string" && config.prompt.trim()) ||
      (typeof config.system === "string" && config.system.trim());
    if (!anyConfig) {
      throw new Error(
        "Connected input node(s) did not provide usable data. Please ensure input nodes have values or set a prompt in the node configuration.",
      );
    }
    prompt = (typeof config.prompt === "string" ? config.prompt.trim() : undefined) || "";
  }

  return {
    prompt,
    messages,
    userSystem,
    serverSystemPrompt,
    system,
    inbound,
  };
}

async function readSsePayloads(
  response: Response,
  onData: (payload: string) => void | Promise<void>,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const dataLines = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) continue;
      const payload = dataLines.join("\n");
      await onData(payload);
    }
  }
}

async function streamOpenAiChatCompletion(params: {
  response: Response;
  nodeId: string;
  ctx: RuntimeContext;
}): Promise<string> {
  let textOut = "";
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "started",
    format: "markdown",
  });
  await readSsePayloads(params.response, async (payload) => {
    if (payload === "[DONE]") return;
    const chunk = JSON.parse(payload) as Record<string, any>;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      textOut += delta;
      await params.ctx.streamNodeOutput?.(params.nodeId, {
        status: "streaming",
        delta,
        format: "markdown",
      });
    }
  });
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "finished",
    text: textOut,
    format: "markdown",
  });
  return textOut;
}

async function streamAnthropicChatCompletion(params: {
  response: Response;
  nodeId: string;
  ctx: RuntimeContext;
}): Promise<string> {
  let textOut = "";
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "started",
    format: "markdown",
  });
  await readSsePayloads(params.response, async (payload) => {
    const chunk = JSON.parse(payload) as Record<string, any>;
    const delta =
      chunk?.type === "content_block_delta" && typeof chunk.delta?.text === "string"
        ? chunk.delta.text
        : "";
    if (delta) {
      textOut += delta;
      await params.ctx.streamNodeOutput?.(params.nodeId, {
        status: "streaming",
        delta,
        format: "markdown",
      });
    }
  });
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "finished",
    text: textOut,
    format: "markdown",
  });
  return textOut;
}

async function streamGeminiChatCompletion(params: {
  response: Response;
  nodeId: string;
  ctx: RuntimeContext;
}): Promise<string> {
  let textOut = "";
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "started",
    format: "markdown",
  });
  await readSsePayloads(params.response, async (payload) => {
    const chunk = JSON.parse(payload) as Record<string, any>;
    const deltaParts = chunk.candidates?.[0]?.content?.parts;
    if (!Array.isArray(deltaParts)) return;
    const delta = deltaParts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
    if (delta) {
      textOut += delta;
      await params.ctx.streamNodeOutput?.(params.nodeId, {
        status: "streaming",
        delta,
        format: "markdown",
      });
    }
  });
  await params.ctx.streamNodeOutput?.(params.nodeId, {
    status: "finished",
    text: textOut,
    format: "markdown",
  });
  return textOut;
}

/** Unified LLM Chat: routes OpenAI / Anthropic / Gemini from a single model dropdown. */
const openaiChatHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  /** Provider + UI token streaming when the runner supports it; explicit `stream: false` opts out. */
  const useLlmStream =
    Boolean(ctx.streamNodeOutput) && (config as { stream?: boolean }).stream !== false;
  const {
    prompt: promptRaw,
    messages,
    serverSystemPrompt,
    system,
  } = buildWorkflowChatPromptParts(node, ctx, config);
  let prompt = promptRaw;

  const isBuilderTest = !!(ctx.inputs as any)?.["__builder_test"];
  let model = (config.model as string) || DEFAULT_LLM_CHAT_MODEL;
  const pInit = resolveLlmChatProvider(model);
  const builderUserKey =
    (pInit === "openai" && !!(ctx.inputs as any)?.["__builder_user_key_openai"]) ||
    (pInit === "anthropic" && !!(ctx.inputs as any)?.["__builder_user_key_anthropic"]) ||
    (pInit === "google" && !!(ctx.inputs as any)?.["__builder_user_key_gemini"]) ||
    (!!(ctx.inputs as any)?.["__builder_user_key"] &&
      isOpenAiBackedSpec(node.data?.specId ?? "") &&
      canonicalSpecId(node.data?.specId ?? "") !== "llm-chat");

  const hasConfigKey = typeof config.apiKey === "string" && config.apiKey.trim();
  const usePremium = !isBuilderTest || builderUserKey || !!hasConfigKey;

  const perNodePlatformModel = (ctx.inputs as any)?.[`__platform_llm_model_${node.id}`] as
    | string
    | undefined;
  const platformForced = (ctx.inputs as any)?.["__platform_llm_chat_model"] as string | undefined;
  if (perNodePlatformModel?.trim()) {
    model = perNodePlatformModel.trim();
  } else if (!usePremium && platformForced) {
    model = platformForced;
  }
  if (isLegacyOpenAiChatNode(node)) {
    model = LEGACY_OPENAI_CHAT_MODEL;
  }

  // Gemini preview IDs rotate frequently; map legacy stored IDs to models that exist for v1beta ListModels.
  const LEGACY_GEMINI_CHAT_MODEL: Record<string, string> = {
    "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
  };
  model = LEGACY_GEMINI_CHAT_MODEL[model] ?? model;

  const provider = resolveLlmChatProvider(model);
  const apiKey =
    getApiKey(node, ctx) ?? (provider === "google" ? hostedGeminiKeyFromRunInputs(ctx) : null);
  if (!apiKey) {
    throw new Error(
      "API key required for LLM Chat. Add the matching provider key in the run modal or node inspector.",
    );
  }

  const rateProvider = provider === "google" ? "google" : provider;
  const rateCheck = await checkProviderRateLimit({
    provider: rateProvider,
    userId: ctx.requestMetadata?.userId ?? null,
    isPlatformKey: !isUserProvidedApiKey(node, ctx),
  });
  if (!rateCheck.allowed) {
    throw new Error(
      `API rate limit exceeded (${provider}). Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)}s.`,
    );
  }

  const temperature = (config.temperature as number) ?? 0.7;
  const effectiveMaxTokens = usePremium
    ? ((config.maxTokens as number) ?? 2000)
    : Math.min(5000, (config.maxTokens as number) ?? 2000);
  const maxTokens = effectiveMaxTokens;

  const workflowId = (ctx.inputs as any)?.["__workflow_id"];
  const tokenLimits = await getTokenLimits(workflowId);
  const nodeTokenCap = usePremium ? tokenLimits.maxTokensPerNode : 5000;

  let messagesForTokenCount = messages;
  if (messages && Array.isArray(messages)) {
    const tempMessages = [{ role: "system", content: serverSystemPrompt } as const];
    const userSystemMsg = messages.find((m: any) => m.role === "system");
    if (userSystemMsg && userSystemMsg.content) {
      tempMessages[0] = {
        role: "system",
        content: `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}`,
      };
      tempMessages.push(...messages.filter((m: any) => m.role !== "system"));
    } else {
      tempMessages.push(...messages);
    }
    messagesForTokenCount = tempMessages;
  }

  const tokenCount = countChatTokens({
    prompt,
    system,
    messages: messagesForTokenCount,
    maxTokens,
  });
  const tokenValidation = validateNodeTokenLimit(node.id, tokenCount.total, "chat", nodeTokenCap);
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const LLM_CHAT_DEFAULT_TIMEOUT_MS = 120_000;
  const configuredTimeout =
    typeof config.timeout === "number" && Number.isFinite(config.timeout) && config.timeout > 0
      ? config.timeout
      : 0;
  const timeout = Math.max(configuredTimeout, LLM_CHAT_DEFAULT_TIMEOUT_MS);
  const { controller, dispose } = createTimeoutAbortController(timeout, ctx.abortSignal);

  try {
    if (provider === "anthropic") {
      let anthropicMessages: { role: "user" | "assistant"; content: string }[];
      let systemCombined: string;

      if (messages && Array.isArray(messages)) {
        const messageList: any[] = [];
        messageList.push({ role: "system", content: serverSystemPrompt });
        const userSystemMsg = messages.find((m: any) => m.role === "system");
        if (userSystemMsg && userSystemMsg.content) {
          messageList[0].content = `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}`;
          messageList.push(...messages.filter((m: any) => m.role !== "system"));
        } else {
          messageList.push(...messages);
        }
        systemCombined =
          messageList.find((m: any) => m.role === "system")?.content ??
          (typeof system === "string" ? system : serverSystemPrompt);
        anthropicMessages = messageList
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : safeToString(m.content),
          }));
        if (anthropicMessages.length === 0) {
          anthropicMessages = [{ role: "user", content: prompt || "" }];
        }
      } else {
        systemCombined = typeof system === "string" ? system : serverSystemPrompt;
        anthropicMessages = [{ role: "user", content: prompt || "" }];
      }

      const maxOut = Math.min(maxTokens, nodeTokenCap - tokenCount.input, 8192);
      const anthropicModel = resolveAnthropicApiModel(model);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: Math.max(1, maxOut),
          temperature: Math.min(1, temperature),
          system: systemCombined,
          messages: anthropicMessages,
          stream: useLlmStream,
        }),
        signal: controller.signal,
      });

      dispose();

      if (!response.ok) {
        if (response.status === 429) {
          record429Cooldown({
            provider: "anthropic",
            userId: ctx.requestMetadata?.userId ?? null,
            isPlatformKey: !isUserProvidedApiKey(node, ctx),
          });
        }
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${error}`);
      }

      await recordProviderUsage({
        provider: "anthropic",
        userId: ctx.requestMetadata?.userId ?? null,
        isPlatformKey: !isUserProvidedApiKey(node, ctx),
      });

      let textOut = "";
      if (useLlmStream) {
        textOut = await streamAnthropicChatCompletion({
          response,
          nodeId: node.id,
          ctx,
        });
      } else {
        const data = await response.json();
        const blocks = data.content;
        if (Array.isArray(blocks)) {
          for (const b of blocks) {
            if (b?.type === "text" && typeof b.text === "string") textOut += b.text;
          }
        }
      }
      ctx.setNodeOutput(node.id, textOut);
      return textOut;
    }

    if (provider === "google") {
      let userText = "";
      if (messages && Array.isArray(messages)) {
        const messageList: any[] = [];
        messageList.push({ role: "system", content: serverSystemPrompt });
        const userSystemMsg = messages.find((m: any) => m.role === "system");
        if (userSystemMsg && userSystemMsg.content) {
          messageList[0].content = `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}`;
          messageList.push(...messages.filter((m: any) => m.role !== "system"));
        } else {
          messageList.push(...messages);
        }
        const parts = messageList
          .filter((m: any) => m.role !== "system")
          .map(
            (m: any) =>
              `${m.role}: ${typeof m.content === "string" ? m.content : safeToString(m.content)}`,
          );
        userText = parts.join("\n\n");
      } else {
        userText = typeof system === "string" ? `${system}\n\n${prompt || ""}` : prompt || "";
      }

      const maxOut = Math.min(maxTokens, nodeTokenCap - tokenCount.input, 8192);
      const url = useLlmStream
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            maxOutputTokens: Math.max(1, maxOut),
            temperature,
          },
        }),
        signal: controller.signal,
      });

      dispose();

      if (!response.ok) {
        if (response.status === 429) {
          record429Cooldown({
            provider: "google",
            userId: ctx.requestMetadata?.userId ?? null,
            isPlatformKey: !isUserProvidedApiKey(node, ctx),
          });
        }
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${error}`);
      }

      await recordProviderUsage({
        provider: "google",
        userId: ctx.requestMetadata?.userId ?? null,
        isPlatformKey: !isUserProvidedApiKey(node, ctx),
      });

      let textOut = "";
      if (useLlmStream) {
        textOut = await streamGeminiChatCompletion({
          response,
          nodeId: node.id,
          ctx,
        });
      } else {
        const data = await response.json();
        const partsOut = data.candidates?.[0]?.content?.parts;
        if (Array.isArray(partsOut)) {
          for (const p of partsOut) {
            if (typeof p?.text === "string") textOut += p.text;
          }
        }
      }
      ctx.setNodeOutput(node.id, textOut);
      return textOut;
    }

    // OpenAI Chat Completions
    const cappedOutTokens = Math.min(maxTokens, nodeTokenCap - tokenCount.input);
    const requestBody: Record<string, unknown> = {
      model,
      stream: useLlmStream,
    };
    if (openaiChatUsesMaxCompletionTokens(model)) {
      requestBody.max_completion_tokens = cappedOutTokens;
    } else {
      requestBody.max_tokens = cappedOutTokens;
    }
    if (!/^o\d/i.test(model)) {
      requestBody.temperature = temperature;
    }

    if (messages && Array.isArray(messages)) {
      const messageList: any[] = [];
      messageList.push({ role: "system", content: serverSystemPrompt });
      const userSystemMsg = messages.find((m: any) => m.role === "system");
      if (userSystemMsg && userSystemMsg.content) {
        messageList[0].content = `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}`;
        messageList.push(...messages.filter((m: any) => m.role !== "system"));
      } else {
        messageList.push(...messages);
      }
      requestBody.messages = messageList;
    } else {
      requestBody.messages = [
        { role: "system", content: system },
        { role: "user", content: prompt || "" },
      ];
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    dispose();

    if (!response.ok) {
      if (response.status === 429) {
        record429Cooldown({
          provider: "openai",
          userId: ctx.requestMetadata?.userId ?? null,
          isPlatformKey: !isUserProvidedApiKey(node, ctx),
        });
      }
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    await recordProviderUsage({
      provider: "openai",
      userId: ctx.requestMetadata?.userId ?? null,
      isPlatformKey: !isUserProvidedApiKey(node, ctx),
    });

    const content = useLlmStream
      ? await streamOpenAiChatCompletion({
          response,
          nodeId: node.id,
          ctx,
        })
      : ((await response.json()).choices?.[0]?.message?.content ?? "");
    ctx.setNodeOutput(node.id, content);
    return content;
  } catch (err: any) {
    dispose();
    if (err.name === "AbortError") {
      throw new Error("LLM Chat request timeout");
    }
    throw err;
  }
};

const openaiEmbeddingsHandler: NodeRuntimeHandler = async (
  node: GraphNode,
  ctx: RuntimeContext,
) => {
  const apiKey = getApiKey(node, ctx);
  if (!apiKey) {
    throw new Error("OpenAI API key required for LLM Embeddings");
  }

  const rateCheck = await checkProviderRateLimit({
    provider: "openai",
    userId: ctx.requestMetadata?.userId ?? null,
    isPlatformKey: !isUserProvidedApiKey(node, ctx),
  });
  if (!rateCheck.allowed) {
    throw new Error(
      `OpenAI rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)}s.`,
    );
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const raw = inbound[0];
  const content = extractPipelineContent(raw);
  const fromInbound =
    content === null || content === undefined
      ? ""
      : typeof content === "string"
        ? content.trim()
        : safeToString(content).trim();
  const text = fromInbound || (typeof config.text === "string" ? config.text.trim() : undefined);

  if (!text) {
    throw new Error("Text input required for embeddings");
  }

  // Get token limits
  const workflowId = (ctx.inputs as any)?.["__workflow_id"];
  const tokenLimits = await getTokenLimits(workflowId);

  // Count and validate tokens
  const tokenCount = countEmbeddingTokens(text);
  const tokenValidation = validateNodeTokenLimit(
    node.id,
    tokenCount,
    "embeddings",
    tokenLimits.maxTokensPerNode,
  );
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const model = config.model || "text-embedding-3-small";
  const timeout = config.timeout ?? 15000;

  const { controller, dispose } = createTimeoutAbortController(timeout, ctx.abortSignal);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
      signal: controller.signal,
    });

    dispose();

    if (!response.ok) {
      if (response.status === 429) {
        record429Cooldown({
          provider: "openai",
          userId: ctx.requestMetadata?.userId ?? null,
          isPlatformKey: !isUserProvidedApiKey(node, ctx),
        });
      }
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    await recordProviderUsage({
      provider: "openai",
      userId: ctx.requestMetadata?.userId ?? null,
      isPlatformKey: !isUserProvidedApiKey(node, ctx),
    });

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding ?? [];

    ctx.setNodeOutput(node.id, embedding);
    return embedding;
  } catch (err: any) {
    dispose();
    if (err.name === "AbortError") {
      throw new Error("OpenAI embeddings request timeout");
    }
    throw err;
  }
};

const openaiImageHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  let model = (config.model as string) || DEFAULT_LLM_IMAGE_MODEL;
  if (isLegacyOpenAiImageNode(node)) {
    model = LEGACY_OPENAI_IMAGE_MODEL;
  }
  const imageProvider = resolveLlmImageProvider(model);

  const inbound = ctx.getInboundValues(node.id);
  const raw = inbound[0];
  const content = extractPipelineContent(raw);
  const fromInbound =
    content === null || content === undefined
      ? ""
      : typeof content === "string"
        ? content.trim()
        : safeToString(content).trim();
  const prompt =
    fromInbound || (typeof config.prompt === "string" ? config.prompt.trim() : undefined);

  if (!prompt) {
    throw new Error("Prompt required for image generation");
  }

  const aspectRatio = resolveLlmImageAspectRatio(config as Record<string, unknown>);
  const effectivePrompt = prompt;

  const apiKey =
    getApiKey(node, ctx) ?? (imageProvider === "google" ? hostedGeminiKeyFromRunInputs(ctx) : null);
  const hasApiKey = !!apiKey;
  const isUserApiKey = isUserProvidedApiKey(node, ctx);
  const requestMeta = ctx.requestMetadata;
  const userId = requestMeta?.userId || undefined;

  const workflowId = (ctx.inputs as any)?.["__workflow_id"] || requestMeta?.workflowId;
  const tokenLimits = await getTokenLimits(workflowId);
  const tokenCount = countImageTokens(prompt);
  const tokenValidation = validateNodeTokenLimit(
    node.id,
    tokenCount,
    "image",
    tokenLimits.maxTokensPerNode,
  );
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const configuredTimeout =
    typeof config.timeout === "number" && Number.isFinite(config.timeout) ? config.timeout : 0;
  const timeout = Math.max(configuredTimeout, DEFAULT_LLM_IMAGE_TIMEOUT_MS);

  const runGeminiImageGeneration = async (
    geminiApiKey: string,
    requestedModel: string,
  ): Promise<string> => {
    const LEGACY_GEMINI_LLM_IMAGE_MODEL: Record<string, string> = {
      // Older workflows stored non-preview IDs that 404 on v1beta for many keys.
      "gemini-3.1-flash-image": "gemini-3.1-flash-image-preview",
    };
    const geminiModel = LEGACY_GEMINI_LLM_IMAGE_MODEL[requestedModel] ?? requestedModel;

    const geminiRateCheck = await checkProviderRateLimit({
      provider: "google",
      userId: ctx.requestMetadata?.userId ?? null,
      isPlatformKey: !isUserProvidedApiKey(node, ctx),
    });
    if (!geminiRateCheck.allowed) {
      throw new Error(
        `Image API rate limit exceeded. Retry after ${Math.ceil((geminiRateCheck.retryAfterMs ?? 60000) / 1000)}s.`,
      );
    }

    const { controller, dispose } = createTimeoutAbortController(timeout, ctx.abortSignal);

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
      const gres = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: effectivePrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!gres.ok) {
        if (gres.status === 429) {
          record429Cooldown({
            provider: "google",
            userId: ctx.requestMetadata?.userId ?? null,
            isPlatformKey: !isUserProvidedApiKey(node, ctx),
          });
        }
        const error = await gres.text();
        throw new Error(`Gemini image API error: ${gres.status} ${error}`);
      }

      await recordProviderUsage({
        provider: "google",
        userId: ctx.requestMetadata?.userId ?? null,
        isPlatformKey: !isUserProvidedApiKey(node, ctx),
      });

      const gdata = await gres.json();
      const parts = gdata.candidates?.[0]?.content?.parts;
      let imageUrl = "";
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (p.inlineData?.data) {
            const mime = p.inlineData.mimeType || "image/png";
            imageUrl = `data:${mime};base64,${p.inlineData.data}`;
            break;
          }
        }
      }
      if (!imageUrl) {
        const returnedPartTypes = Array.isArray(parts)
          ? parts
              .map((p: any) =>
                p?.inlineData?.data
                  ? "inlineData"
                  : typeof p?.text === "string"
                    ? "text"
                    : "unknown",
              )
              .join(",")
          : "none";
        throw new Error(
          `Gemini did not return image data (parts: ${returnedPartTypes}). Try another image model (e.g. gemini-2.5-flash-image, gemini-3-pro-image-preview) or simplify the prompt.`,
        );
      }

      return imageUrl;
    } finally {
      dispose();
    }
  };

  const runOpenAiImageGeneration = async (openAiApiKey: string, requestedModel: string) => {
    const OPENAI_IMAGE_LEGACY_MODEL: Record<string, string> = {
      "dall-e-2": "gpt-image-1-mini",
      "dall-e-3": "gpt-image-1.5",
      "gpt-image-1": "gpt-image-1.5",
    };
    const openAiModel = OPENAI_IMAGE_LEGACY_MODEL[requestedModel] ?? requestedModel;

    const openAiRateCheck = await checkProviderRateLimit({
      provider: "openai",
      userId: ctx.requestMetadata?.userId ?? null,
      isPlatformKey: !isUserProvidedApiKey(node, ctx),
    });
    if (!openAiRateCheck.allowed) {
      throw new Error(
        `Image API rate limit exceeded. Retry after ${Math.ceil((openAiRateCheck.retryAfterMs ?? 60000) / 1000)}s.`,
      );
    }

    const validSize = openaiImagePixelSizeFromAspectRatio(aspectRatio);
    const gptQuality = openaiGptImageQualityParam(config.quality as string | undefined);

    const body: Record<string, unknown> = {
      model: openAiModel,
      prompt,
      n: 1,
      size: validSize,
      quality: gptQuality,
    };

    const { controller, dispose } = createTimeoutAbortController(timeout, ctx.abortSignal);

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          record429Cooldown({
            provider: "openai",
            userId: ctx.requestMetadata?.userId ?? null,
            isPlatformKey: !isUserProvidedApiKey(node, ctx),
          });
        }
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      await recordProviderUsage({
        provider: "openai",
        userId: ctx.requestMetadata?.userId ?? null,
        isPlatformKey: !isUserProvidedApiKey(node, ctx),
      });

      const data = await response.json();
      let imageUrl = data.data?.[0]?.url ?? "";
      if (!imageUrl && data.data?.[0]?.b64_json) {
        imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      }

      return imageUrl;
    } finally {
      dispose();
    }
  };

  if (imageProvider === "openai") {
    if (!isUserApiKey && requestMeta?.identifier && requestMeta?.identifierType) {
      const rateLimitCheck = await checkImageGenerationAllowed(
        requestMeta.identifier,
        requestMeta.identifierType,
        userId,
        false,
      );
      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.requiresApiKey) {
          throw new Error(
            rateLimitCheck.error ||
              "Image generation requires your OpenAI API key in the run modal, or sign in to use the platform key.",
          );
        }
        throw new Error(
          rateLimitCheck.error ||
            "Image generation is not allowed at this time. Please provide your OpenAI API key.",
        );
      }
    } else if (!isUserApiKey && !hasApiKey) {
      throw new Error(
        "OpenAI API key required for image generation. Please provide your API key in the run modal.",
      );
    }
  } else if (!hasApiKey) {
    throw new Error(
      "Google Gemini API key required for this image model. Add it in the run modal or node inspector.",
    );
  }

  if (!apiKey) {
    throw new Error("API key required for image generation.");
  }

  try {
    if (imageProvider === "google") {
      const imageUrl = await runGeminiImageGeneration(apiKey, model);
      ctx.setNodeOutput(node.id, imageUrl);
      return imageUrl;
    }
    let imageUrl = "";
    try {
      imageUrl = await runOpenAiImageGeneration(apiKey, model);
    } catch (primaryError: unknown) {
      const fallbackKey = getEdgazeGeminiApiKey();
      const canFallback = model !== DEFAULT_LLM_IMAGE_MODEL && typeof fallbackKey === "string";
      if (!canFallback) {
        throw primaryError;
      }
      try {
        imageUrl = await runGeminiImageGeneration(fallbackKey, DEFAULT_LLM_IMAGE_MODEL);
      } catch (fallbackError: unknown) {
        const primaryMessage = formatRemoteImageGenerationError(primaryError).message;
        const fallbackMessage = formatRemoteImageGenerationError(fallbackError).message;
        throw new Error(
          `Primary image generation failed (${primaryMessage}). Nano Banana fallback also failed (${fallbackMessage}).`,
        );
      }
    }

    const usedFreeTier = !isUserApiKey && userId !== undefined;
    if (requestMeta?.identifier && requestMeta?.identifierType) {
      await recordImageGeneration(
        requestMeta.identifier,
        requestMeta.identifierType,
        userId || null,
        workflowId || null,
        node.id,
        imageUrl || null,
        usedFreeTier,
        isUserApiKey,
      );
    }

    ctx.setNodeOutput(node.id, imageUrl);
    return imageUrl;
  } catch (err: unknown) {
    throw formatRemoteImageGenerationError(err);
  }
};

/** Resolve request URL from inbound (string, { url }, or Input node { value, question }) or config. */
function resolveHttpRequestUrl(inbound0: unknown, configUrl: unknown): string | undefined {
  if (typeof inbound0 === "string" && inbound0.trim()) return inbound0.trim();
  if (inbound0 && typeof inbound0 === "object" && !Array.isArray(inbound0)) {
    const o = inbound0 as Record<string, unknown>;
    if (typeof o.url === "string" && o.url.trim()) return o.url.trim();
    if (typeof o.value === "string" && o.value.trim()) return o.value.trim();
  }
  if (typeof configUrl === "string" && configUrl.trim()) return configUrl.trim();
  return undefined;
}

function normalizeHostList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (typeof raw === "string")
    return raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  return [];
}

const httpRequestHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const inbound0 = extractPipelineContent(inbound[0]);
  const url = resolveHttpRequestUrl(inbound0, config.url);
  const headers =
    (inbound0 && typeof inbound0 === "object" && !Array.isArray(inbound0)
      ? ((inbound0 as any).headers as Record<string, string> | undefined)
      : undefined) ?? undefined;
  const body =
    inbound0 && typeof inbound0 === "object" && !Array.isArray(inbound0)
      ? (inbound0 as any).body
      : undefined;

  if (!url) {
    throw new Error("URL required for HTTP request");
  }

  const allowOnly = normalizeHostList(config.allowOnly);
  const denyHosts = normalizeHostList(config.denyHosts);

  const urlCheck = validateUrlForWorkflow(url, {
    allowOnly: allowOnly.length > 0 ? allowOnly : undefined,
    denyHosts: denyHosts.length > 0 ? denyHosts : undefined,
  });
  if (!urlCheck.allowed) {
    throw new Error(urlCheck.error ?? "URL validation failed");
  }

  // Resolve the hostname right now and re-validate the actual IP addresses returned
  // by the DNS resolver. This closes two attack vectors:
  //   1. DNS rebinding: attacker initially points domain at a public IP (passes the
  //      string check above), then flips DNS to 127.0.0.1 before fetch() runs.
  //   2. Alternate IP notation: hex/decimal/short IP literals that some resolvers
  //      expand to private addresses are caught here because resolved addresses are
  //      always in canonical form.
  const dnsCheck = await resolveAndValidateHostnameIp(new URL(url).hostname);
  if (!dnsCheck.allowed) {
    throw new Error(dnsCheck.error ?? "URL validation failed (resolved IP)");
  }

  const method = (config.method || "GET").toUpperCase();
  // Only config.hasSideEffects opts into idempotency enforcement (contract-level hasSideEffects is for retries/pooling).
  if (config.hasSideEffects === true && ["POST", "PUT", "PATCH"].includes(method)) {
    const idempotencyKey =
      config.idempotencyKey ??
      (inbound0 && typeof inbound0 === "object" && (inbound0 as any).idempotencyKey);
    if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      throw new Error(
        "POST/PUT/PATCH with hasSideEffects enabled require idempotencyKey in config or inbound object",
      );
    }
  }

  const timeout = config.timeout ?? 30000;
  const hasAllowlist = allowOnly.length > 0;
  const followRedirects = !hasAllowlist && config.followRedirects !== false;

  const sanitizedHeaders = stripSensitiveHeaders(
    (headers && typeof headers === "object" ? headers : {}) as Record<string, string>,
  );
  const idempotencyKey =
    config.idempotencyKey ??
    (inbound0 && typeof inbound0 === "object" ? (inbound0 as any).idempotencyKey : undefined);
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...sanitizedHeaders,
  };
  if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    requestHeaders["Idempotency-Key"] = idempotencyKey.trim();
  }

  const { controller, dispose } = createTimeoutAbortController(timeout, ctx.abortSignal);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: controller.signal,
      redirect: hasAllowlist ? "manual" : followRedirects ? "follow" : "manual",
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    dispose();

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const len = parseInt(contentLength, 10);
      if (!Number.isNaN(len) && len > MAX_HTTP_RESPONSE_BYTES) {
        throw new Error(`Response too large: ${len} bytes (max ${MAX_HTTP_RESPONSE_BYTES})`);
      }
    }

    const contentType = response.headers.get("content-type") || "";
    let responseData: unknown;

    const readLimited = async (): Promise<ArrayBuffer> => {
      if (!response.body) return new ArrayBuffer(0);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_HTTP_RESPONSE_BYTES) {
          reader.cancel();
          throw new Error(`Response too large: exceeds ${MAX_HTTP_RESPONSE_BYTES} bytes`);
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        combined.set(c, offset);
        offset += c.length;
      }
      return combined.buffer;
    };

    const buf = await readLimited();
    const text = new TextDecoder().decode(buf);
    if (contentType.includes("application/json")) {
      try {
        responseData = JSON.parse(text);
        if (exceedsJsonDepth(responseData, MAX_JSON_DEPTH)) {
          throw new Error(`JSON depth exceeds ${MAX_JSON_DEPTH}`);
        }
      } catch (e: any) {
        if (e.message?.includes("depth") || e.message?.includes("bytes")) throw e;
        throw new Error(`Invalid JSON: ${e.message}`);
      }
    } else {
      responseData = text;
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    };

    ctx.setNodeOutput(node.id, result);
    return result;
  } catch (err: any) {
    dispose();
    if (err.name === "AbortError") {
      throw new Error("HTTP request timeout");
    }
    throw err;
  }
};

const jsonParseHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const inbound = ctx.getInboundValues(node.id);
  const input = extractPipelineContent(inbound[0]);

  if (typeof input !== "string") {
    ctx.setNodeOutput(node.id, input);
    return input;
  }

  try {
    const parsed = JSON.parse(input);
    ctx.setNodeOutput(node.id, parsed);
    return parsed;
  } catch (err: any) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
};

/** Condition node passthrough shape: routes boolean result but passes input through for downstream. */
export const CONDITION_PASSTHROUGH_KEY = "__passthrough" as const;
export const CONDITION_RESULT_KEY = "__conditionResult" as const;

/**
 * Extract the actual content from an inbound value for pipeline flow.
 * Unwraps condition passthrough, input node { value, question }, OpenAI { content }, etc.
 * Used by merge, openai-chat, and other nodes that need the original input to flow through.
 */
export function extractPipelineContent(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  // Condition node: pass through the evaluated input for downstream use
  if (typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    if (CONDITION_RESULT_KEY in obj && CONDITION_PASSTHROUGH_KEY in obj) {
      return obj[CONDITION_PASSTHROUGH_KEY];
    }
    // Input node format { value, question } — unwrap to the actual value
    if ("value" in obj && "question" in obj) {
      return obj.value;
    }
  }
  return v;
}

const conditionHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const value = inbound[0];

  const operator = (config.operator as string) || "truthy";
  const compareValue = config.compareValue;
  const humanCondition =
    typeof config.humanCondition === "string" ? config.humanCondition : undefined;

  const apiKey = getApiKey(node, ctx);
  if (!apiKey) {
    throw new Error(
      "Condition node needs an OpenAI API key (builder run modal, free-run platform key, or node config).",
    );
  }

  const instruction = buildConditionEvaluationInstruction({
    operator,
    compareValue,
    humanCondition,
  });
  const aiResult = await evaluateConditionWithAI(instruction, value, apiKey);
  const result = aiResult.result;
  console.warn(
    `[Condition Node ${node.id}] AI evaluation (${operator}) = ${result} (confidence: ${aiResult.confidence})`,
  );

  // Output: { __conditionResult, __passthrough } so routing uses boolean and downstream gets original input
  const output = {
    [CONDITION_RESULT_KEY]: result,
    [CONDITION_PASSTHROUGH_KEY]: value,
  };
  ctx.setNodeOutput(node.id, output);
  return output;
};

const delayHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const duration = config.duration ?? 1000;

  await waitWithAbort(Math.max(0, Math.min(duration, 600000)), ctx.abortSignal);

  const value = inbound.length > 0 ? extractPipelineContent(inbound[0]) : null;
  ctx.setNodeOutput(node.id, value);
  return value;
};

const loopHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const array = extractPipelineContent(inbound[0]);

  if (!Array.isArray(array)) {
    throw new Error("Loop input must be an array");
  }

  const maxIterations = config.maxIterations ?? 1000;
  if (array.length > maxIterations) {
    throw new Error(`Array length (${array.length}) exceeds max iterations (${maxIterations})`);
  }

  // For now, loop node just outputs the array
  // Full iteration would require subgraph execution (future enhancement)
  ctx.setNodeOutput(node.id, array);
  return array;
};

/** merge-json: Merges JSON objects into one. Input: array of json objects. */
const mergeJsonHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const deep = config.deep === true;
  const valid = inbound
    .map((v) => extractPipelineContent(v))
    .filter((v) => v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v));
  if (valid.length === 0) {
    ctx.setNodeOutput(node.id, {});
    return {};
  }
  if (deep) {
    const deepMerge = (target: any, ...sources: any[]): any => {
      for (const src of sources) {
        if (src && typeof src === "object" && !Array.isArray(src)) {
          for (const k of Object.keys(src)) {
            if (
              src[k] &&
              typeof src[k] === "object" &&
              !Array.isArray(src[k]) &&
              target[k] &&
              typeof target[k] === "object" &&
              !Array.isArray(target[k])
            ) {
              target[k] = deepMerge({ ...target[k] }, src[k]);
            } else {
              target[k] = src[k];
            }
          }
        }
      }
      return target;
    };
    const result = deepMerge({}, ...valid);
    ctx.setNodeOutput(node.id, result);
    return result;
  }
  const result = Object.assign({}, ...valid);
  ctx.setNodeOutput(node.id, result);
  return result;
};

/** template: String interpolation with {{fieldName}} placeholders. No eval. */
const templateHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const template = config.template ?? "";
  let data: Record<string, unknown> = {};
  for (const v of inbound) {
    const content = extractPipelineContent(v);
    if (
      content !== null &&
      content !== undefined &&
      typeof content === "object" &&
      !Array.isArray(content)
    ) {
      data = { ...data, ...(content as Record<string, unknown>) };
    }
  }
  const result = String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null ? "" : safeToString(val);
  });
  ctx.setNodeOutput(node.id, result);
  return result;
};

/** map: Template-only over arrays. For each item, render template with item, index, length. No eval. */
const mapHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const array = extractPipelineContent(inbound[0]);
  if (!Array.isArray(array)) {
    throw new Error("Map input must be an array");
  }
  const template = config.template ?? "{{item}}";
  const result = array.map((item, index) => {
    const data: Record<string, unknown> = {
      item,
      index,
      length: array.length,
      ...(item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { value: item }),
    };
    return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = data[key];
      return val === undefined || val === null ? "" : safeToString(val);
    });
  });
  ctx.setNodeOutput(node.id, result);
  return result;
};

export const runtimeRegistry: Record<string, NodeRuntimeHandler> = {
  input: inputHandler,
  merge: mergeHandler,
  "merge-json": mergeJsonHandler,
  template: templateHandler,
  map: mapHandler,
  output: outputHandler,
  "llm-chat": openaiChatHandler,
  "llm-embeddings": openaiEmbeddingsHandler,
  "llm-image": openaiImageHandler,
  "openai-chat": openaiChatHandler,
  "openai-embeddings": openaiEmbeddingsHandler,
  "openai-image": openaiImageHandler,
  "http-request": httpRequestHandler,
  "json-parse": jsonParseHandler,
  condition: conditionHandler,
  delay: delayHandler,
  loop: loopHandler,
};
