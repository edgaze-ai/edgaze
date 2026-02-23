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
  MAX_HTTP_RESPONSE_BYTES,
  MAX_JSON_DEPTH,
  exceedsJsonDepth,
} from "@lib/workflow/domain-allowlist";
import { nodeHasSideEffects } from "@lib/workflow/node-contracts";
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
import { evaluateConditionWithAI } from "../../lib/ai/condition-evaluator";

const inputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Input node: accepts workflow-level input data
  const external = ctx.inputs?.[node.id];

  // Resolve the actual value: external input (string or object e.g. file), then config fallback
  let value: unknown;
  if (external !== undefined && external !== null) {
    value = external;
  } else {
    const configValue = node.data?.config?.value ?? node.data?.config?.text ?? node.data?.config?.defaultValue;
    value = configValue !== undefined && configValue !== null && configValue !== "" ? configValue : "";
  }

  const question = typeof node.data?.config?.question === "string" ? node.data.config.question.trim() : undefined;

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

  console.warn(`[Merge Node ${node.id}] Received inbound values:`, inbound.map(v => ({
    type: typeof v,
    isArray: Array.isArray(v),
    preview: typeof v === "string" ? v.substring(0, 50) : Array.isArray(v) ? `Array[${v.length}]` : typeof v === "object" ? "Object" : String(v)
  })));

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
    const content = extractPipelineContent(v);
    if (typeof content === "string") return content;
    if (content !== null && typeof content === "object" && !Array.isArray(content)) {
      const obj = content as any;
      if (typeof obj.question === "string" && "value" in obj) {
        const answer = obj.value === undefined || obj.value === null ? "" : typeof obj.value === "string" ? obj.value : JSON.stringify(obj.value);
        return answer;
      }
      if (typeof obj.content === "string") return obj.content;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.message === "string") return obj.message;
      if (typeof obj.value === "string") return obj.value;
      try {
        return JSON.stringify(content);
      } catch {
        return String(content);
      }
    }
    if (Array.isArray(content)) return content.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" ");
    return String(content);
  };

  // If only one input, pass it through directly (no merging needed)
  if (valid.length === 1) {
    const single = valid[0];
    const output = toMergeString(single);
    console.warn(`[Merge Node ${node.id}] Single input, passing through:`, output.substring(0, 100));
    ctx.setNodeOutput(node.id, output);
    return output;
  }

  // Multiple inputs: merge all into one string (do not drop any input)
  const stringInputs = valid.map((v) => toMergeString(v));
  const merged = stringInputs.join("\n\n");
  console.warn(`[Merge Node ${node.id}] Merged ${valid.length} inputs into string:`, merged.substring(0, 100));
  ctx.setNodeOutput(node.id, merged);
  return merged;
};

const outputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Output node: combines all connected inputs into final result
  const inbound = ctx.getInboundValues(node.id);

  // Filter out undefined/null and unwrap condition passthrough for pipeline flow
  const valid = inbound
    .filter((v) => v !== undefined && v !== null)
    .map((v) => extractPipelineContent(v));

  if (valid.length === 0) {
    ctx.setNodeOutput(node.id, null);
    return null;
  }

  // If single input, return unwrapped content
  if (valid.length === 1) {
    ctx.setNodeOutput(node.id, valid[0]);
    return valid[0];
  }

  // Multiple inputs: merge intelligently
  const config = node.data?.config ?? {};
  const format = config.format || "json";

  if (format === "text") {
    // Join all as text
    const text = valid.map((v) => String(v)).join("\n");
    ctx.setNodeOutput(node.id, text);
    return text;
  }

  // Default: return as structured object
  const result = {
    results: valid,
    count: valid.length,
    timestamp: Date.now(),
  };

  ctx.setNodeOutput(node.id, result);
  return result;
};

// Premium Node Handlers

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
  // Check if user provided key in modal (builder test)
  if ((ctx.inputs as any)?.["__builder_user_key"]) {
    return true;
  }

  // Check if node config has user's stored API key
  const configKey = node.data?.config?.apiKey;
  if (typeof configKey === "string" && configKey.trim().length > 0) {
    return true;
  }

  // Otherwise, it's Edgaze's key (for free tier)
  return false;
};

const openaiChatHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const apiKey = getApiKey(node, ctx);
  if (!apiKey) {
    throw new Error("OpenAI API key required. Please provide your API key in the run modal.");
  }

  const rateCheck = await checkProviderRateLimit({
    provider: "openai",
    userId: ctx.requestMetadata?.userId ?? null,
    isPlatformKey: !isUserProvidedApiKey(node, ctx),
  });
  if (!rateCheck.allowed) {
    throw new Error(
      `OpenAI rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)}s.`
    );
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);

  // Debug: log inbound values to help diagnose issues
  console.warn(`[OpenAI Chat] Node ${node.id} received inbound values:`, inbound.length, inbound.map(v => typeof v === "string" ? `"${v.substring(0, 50)}${v.length > 50 ? "..." : ""}"` : typeof v));

  // Extract prompt/messages from inbound - BE LENIENT, convert ANYTHING to usable format
  let inboundMessages: any[] | undefined = undefined;

  // First: look for messages array (highest priority); unwrap condition passthrough
  for (const val of inbound) {
    if (val === null || val === undefined) continue;
    const content = extractPipelineContent(val);

    if (Array.isArray(content) && content.length > 0) {
      // Check if it's OpenAI messages format
      if (content.every((item: any) => item && typeof item === "object" && ("role" in item || "content" in item))) {
        inboundMessages = content;
        break;
      }
    }

    if (typeof content === "object" && !Array.isArray(content) && Array.isArray((content as any).messages)) {
      inboundMessages = (content as any).messages;
      break;
    }
  }

  // Build prompt from ALL inbound values (no dropping): format as "## Inputs" section so OpenAI receives every connected input
  const configPrompt = typeof config.prompt === "string" ? config.prompt.trim() || undefined : undefined;

  /** Convert one inbound value to a string for the Inputs section (handles condition passthrough, input node { value, question }) */
  const oneInboundToInputSegment = (val: unknown): string => {
    const content = extractPipelineContent(val);
    if (content === null || content === undefined) return "";
    if (typeof content === "string") return content;
    if (typeof content === "object" && !Array.isArray(content)) {
      const obj = content as any;
      if (typeof obj.question === "string" && "value" in obj) {
        const answer = obj.value === undefined || obj.value === null ? "" : typeof obj.value === "string" ? obj.value : JSON.stringify(obj.value);
        return answer;
      }
      if (typeof obj.prompt === "string") return obj.prompt;
      if (typeof obj.content === "string") return obj.content;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.message === "string") return obj.message;
      if (typeof obj.value === "string") return obj.value;
      try {
        return JSON.stringify(content);
      } catch {
        return String(content);
      }
    }
    if (Array.isArray(content)) {
      return content.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
    }
    return String(content);
  };

  let prompt: string | undefined;
  if (!inboundMessages && inbound.length > 0) {
    const validInbound = inbound.filter((v) => v !== null && v !== undefined);
    const segments = validInbound.map(oneInboundToInputSegment).filter((s) => s.length > 0 || validInbound.length === 1);
    const inputsSection = segments.join("\n\n");
    if (inputsSection) {
      prompt = configPrompt
        ? `## Inputs\n\n${inputsSection}\n\n## Prompt\n\n${configPrompt}`
        : `## Inputs\n\n${inputsSection}`;
      console.warn(`[OpenAI Chat ${node.id}] Built prompt from ${validInbound.length} inbound value(s) (Inputs section):`, prompt.substring(0, 150));
    } else {
      prompt = configPrompt;
      console.warn(`[OpenAI Chat ${node.id}] No usable text from inbound, using config prompt only:`, configPrompt?.substring(0, 80));
    }
  } else {
    prompt = configPrompt;
    if (inbound.length === 0) {
      console.warn(`[OpenAI Chat ${node.id}] No inbound connections, using config prompt only:`, configPrompt?.substring(0, 80));
    }
  }

  const userSystem = typeof config.system === "string" ? config.system.trim() || undefined : undefined;
  const messages = inboundMessages;

  // Server-side enforced system prompt (from env or default)
  const serverSystemPrompt = process.env.EDGAZE_SERVER_SYSTEM_PROMPT ||
    "You are a helpful AI assistant running in Edgaze workflows. Be concise, accurate, and follow user instructions carefully.\n\nDo not echo or repeat the input values in your response. Just provide the requested output directly.";

  // Combine server system prompt with user's system prompt (server first, then user)
  const system = userSystem
    ? `${serverSystemPrompt}\n\nUser context: ${userSystem}`
    : serverSystemPrompt;

  // If we have system but no user content yet, use empty string so we send [system, user: ""] – OpenAI will still respond
  if (prompt === undefined && system) {
    prompt = "";
  }

  // Only error if we have nothing at all – no prompt, no system, no messages, no usable inbound
  if (prompt === undefined && !messages) {
    if (inbound.length === 0) {
      throw new Error("Prompt or messages array required. Please provide a prompt in the node configuration or connect an input node with data.");
    }
    // Inbound exists but wasn't usable (e.g. merge not run yet, or wrong shape) – still allow config.prompt/system
    const anyConfig = (typeof config.prompt === "string" && config.prompt.trim()) || (typeof config.system === "string" && config.system.trim());
    if (!anyConfig) {
      throw new Error("Connected input node(s) did not provide usable data. Please ensure input nodes have values or set a prompt in the OpenAI Chat node configuration.");
    }
    prompt = (typeof config.prompt === "string" ? config.prompt.trim() : undefined) || "";
  }

  const isBuilderTest = !!(ctx.inputs as any)?.["__builder_test"];
  const builderUserKey = !!(ctx.inputs as any)?.["__builder_user_key"];
  const usePremium = !isBuilderTest || builderUserKey; // User's key => use inspector model and normal limits
  const model = usePremium ? (config.model || "gpt-4o-mini") : "gpt-4o-mini";
  const temperature = config.temperature ?? 0.7;
  const effectiveMaxTokens = usePremium ? (config.maxTokens ?? 2000) : Math.min(5000, config.maxTokens ?? 2000);
  const maxTokens = effectiveMaxTokens;
  const stream = false; // Server run always needs full response; streaming returns SSE and breaks JSON parse

  // Get token limits (workflow-specific or global)
  const workflowId = (ctx.inputs as any)?.["__workflow_id"];
  const tokenLimits = await getTokenLimits(workflowId);
  const nodeTokenCap = usePremium ? tokenLimits.maxTokensPerNode : 5000;

  // Count and validate tokens before making the request
  // When using messages array, we need to account for server system prompt we'll add
  let messagesForTokenCount = messages;
  if (messages && Array.isArray(messages)) {
    // Create a temporary messages array with server system prompt included for accurate token counting
    const tempMessages = [{ role: "system", content: serverSystemPrompt } as const];
    const userSystemMsg = messages.find((m: any) => m.role === "system");
    if (userSystemMsg && userSystemMsg.content) {
      tempMessages[0] = { role: "system", content: `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}` };
      tempMessages.push(...messages.filter((m: any) => m.role !== "system"));
    } else {
      tempMessages.push(...messages);
    }
    messagesForTokenCount = tempMessages;
  }

  const tokenCount = countChatTokens({
    prompt,
    system, // Already includes server prompt + user system
    messages: messagesForTokenCount,
    maxTokens,
  });

  const tokenValidation = validateNodeTokenLimit(
    node.id,
    tokenCount.total,
    "chat",
    nodeTokenCap
  );
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const requestBody: any = {
    model,
    temperature,
    max_tokens: Math.min(maxTokens, nodeTokenCap - tokenCount.input),
    stream,
  };

  if (messages && Array.isArray(messages)) {
    // Prepend server system prompt to messages array (as first system message)
    const messageList: any[] = [];
    messageList.push({ role: "system", content: serverSystemPrompt });

    // If user had a system message in their array, combine it
    const userSystemMsg = messages.find((m: any) => m.role === "system");
    if (userSystemMsg && userSystemMsg.content) {
      messageList[0].content = `${serverSystemPrompt}\n\nUser context: ${userSystemMsg.content}`;
      // Add remaining messages (excluding the user's system message since we combined it)
      messageList.push(...messages.filter((m: any) => m.role !== "system"));
    } else {
      // No user system message, just prepend server system and add all user messages
      messageList.push(...messages);
    }

    requestBody.messages = messageList;
  } else {
    const messageList: any[] = [];
    // Always include server system prompt
    messageList.push({ role: "system", content: system });
    messageList.push({ role: "user", content: prompt || "" });
    requestBody.messages = messageList;
  }

  const timeout = config.timeout ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    const content = data.choices?.[0]?.message?.content ?? "";

    // Store result with content and usage only (no finish_reason in run modal)
    const result = {
      content,
      model: data.model,
      usage: data.usage,
    };

    // Set output - downstream nodes can access both the full object and extract content easily
    // The getInboundValues will pass this object, and nodes can extract .content if needed
    ctx.setNodeOutput(node.id, result);

    // Also store content separately for easier access (nodes can check for both)
    // This ensures backward compatibility and makes data flow smoother
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("OpenAI request timeout");
    }
    throw err;
  }
};

const openaiEmbeddingsHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const apiKey = getApiKey(node, ctx);
  if (!apiKey) {
    throw new Error("OpenAI API key required");
  }

  const rateCheck = await checkProviderRateLimit({
    provider: "openai",
    userId: ctx.requestMetadata?.userId ?? null,
    isPlatformKey: !isUserProvidedApiKey(node, ctx),
  });
  if (!rateCheck.allowed) {
    throw new Error(
      `OpenAI rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)}s.`
    );
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const raw = inbound[0];
  const content = extractPipelineContent(raw);
  const text =
    (typeof content === "string" ? content : undefined) ||
    (typeof config.text === "string" ? config.text : undefined);

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
    tokenLimits.maxTokensPerNode
  );
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const model = config.model || "text-embedding-3-small";
  const timeout = config.timeout ?? 15000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

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

    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("OpenAI embeddings request timeout");
    }
    throw err;
  }
};

const openaiImageHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const apiKey = getApiKey(node, ctx);
  const hasApiKey = !!apiKey;

  // Check if this is user's own API key (not Edgaze's key)
  const isUserApiKey = isUserProvidedApiKey(node, ctx);

  // RATE LIMITING: Check if image generation is allowed (5 free per user, then BYOK)
  const requestMeta = ctx.requestMetadata;
  const userId = requestMeta?.userId || undefined;

  // Only check rate limits if user hasn't provided their own API key
  // If user provided their own key, they bypass free tier limits
  if (!isUserApiKey && requestMeta?.identifier && requestMeta?.identifierType) {
    const rateLimitCheck = await checkImageGenerationAllowed(
      requestMeta.identifier,
      requestMeta.identifierType,
      userId,
      false // Not using user's API key, so hasApiKey = false for free tier check
    );

    if (!rateLimitCheck.allowed) {
      // If requires API key and user hasn't provided one, throw error
      if (rateLimitCheck.requiresApiKey) {
        const freeUsed = rateLimitCheck.freeUsed || 0;
        const freeRemaining = rateLimitCheck.freeRemaining || 0;
        throw new Error(
          rateLimitCheck.error ||
          `You have used all 5 free images (${freeUsed}/5 used). Please provide your OpenAI API key in the run modal to continue generating images.`
        );
      }
      // If check failed for other reasons, throw error
      throw new Error(
        rateLimitCheck.error ||
        "Image generation is not allowed at this time. Please provide your OpenAI API key."
      );
    }
  } else if (!isUserApiKey && !hasApiKey) {
    // No identifier available and no API key - require API key
    throw new Error(
      "OpenAI API key required for image generation. Please provide your API key in the run modal."
    );
  }

  // If no API key at this point, it's an error (should have been caught above)
  if (!apiKey) {
    throw new Error("OpenAI API key required. Please provide your API key in the run modal.");
  }

  const rateCheck = await checkProviderRateLimit({
    provider: "openai",
    userId: ctx.requestMetadata?.userId ?? null,
    isPlatformKey: !isUserProvidedApiKey(node, ctx),
  });
  if (!rateCheck.allowed) {
    throw new Error(
      `OpenAI rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)}s.`
    );
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const raw = inbound[0];
  const content = extractPipelineContent(raw);
  const prompt =
    (typeof content === "string" ? content : undefined) ||
    (typeof config.prompt === "string" ? config.prompt : undefined);

  if (!prompt) {
    throw new Error("Prompt required for image generation");
  }

  // Get token limits
  const workflowId = (ctx.inputs as any)?.["__workflow_id"] || requestMeta?.workflowId;
  const tokenLimits = await getTokenLimits(workflowId);

  // Count and validate tokens (for prompt)
  const tokenCount = countImageTokens(prompt);
  const tokenValidation = validateNodeTokenLimit(
    node.id,
    tokenCount,
    "image",
    tokenLimits.maxTokensPerNode
  );
  if (!tokenValidation.valid) {
    throw new Error(tokenValidation.error || "Token limit exceeded");
  }

  const model = config.model || "dall-e-2"; // Cheapest DALL-E model by default
  const size = config.size || "1024x1024";
  const quality = config.quality || "standard";
  const timeout = config.timeout ?? 60000;

  // DALL-E 2 does not support "quality" parameter — only DALL-E 3 does. Never send it for dall-e-2.
  const DALL_E_2_SIZES = ["256x256", "512x512", "1024x1024"];
  const DALL_E_3_SIZES = ["1024x1024", "1792x1024", "1024x1792"];
  const validSize =
    model === "dall-e-3"
      ? (DALL_E_3_SIZES.includes(size) ? size : "1024x1024")
      : (DALL_E_2_SIZES.includes(size) ? size : "1024x1024");

  const body: Record<string, unknown> = {
    model,
    prompt,
    size: validSize,
    n: 1,
  };
  if (model === "dall-e-3") {
    body.quality = quality === "hd" ? "hd" : "standard";
  }
  // Never send "quality" for dall-e-2 — API returns "Unknown parameter: 'quality'"

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    const imageUrl = data.data?.[0]?.url ?? "";

    // Record the image generation for rate limiting
    // Determine if this was a free tier generation:
    // - Free tier: user didn't provide their own API key (using Edgaze key or no key)
    // - BYOK: user provided their own API key
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
        isUserApiKey
      );
    }

    ctx.setNodeOutput(node.id, imageUrl);
    return imageUrl;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("OpenAI image generation timeout");
    }
    throw err;
  }
};

const httpRequestHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const inbound0 = extractPipelineContent(inbound[0]);
  const url =
    (typeof inbound0 === "string" ? (inbound0 as string) : undefined) ||
    (typeof (inbound0 as any)?.url === "string" ? (inbound0 as any).url : undefined) ||
    (typeof config.url === "string" ? config.url : undefined);
  const headers =
    (inbound0 && typeof inbound0 === "object" && !Array.isArray(inbound0)
      ? ((inbound0 as any).headers as Record<string, string> | undefined)
      : undefined) ?? undefined;
  const body =
    inbound0 && typeof inbound0 === "object" && !Array.isArray(inbound0) ? (inbound0 as any).body : undefined;

  if (!url) {
    throw new Error("URL required for HTTP request");
  }

  const allowOnlyRaw = config.allowOnly;
  const allowOnly = Array.isArray(allowOnlyRaw)
    ? allowOnlyRaw.map((h) => String(h).trim().toLowerCase()).filter(Boolean)
    : (typeof allowOnlyRaw === "string" ? allowOnlyRaw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) : []);
  const denyHosts = (config.denyHosts || "").split(",").map((h: string) => h.trim().toLowerCase()).filter(Boolean);

  const urlCheck = validateUrlForWorkflow(url, {
    allowOnly: allowOnly.length > 0 ? allowOnly : undefined,
    denyHosts: denyHosts.length > 0 ? denyHosts : undefined,
  });
  if (!urlCheck.allowed) {
    throw new Error(urlCheck.error ?? "URL validation failed");
  }

  const method = (config.method || "GET").toUpperCase();
  const hasSideEffects = nodeHasSideEffects("http-request", config);
  if (hasSideEffects && ["POST", "PUT", "PATCH"].includes(method)) {
    const idempotencyKey = config.idempotencyKey ?? (inbound0 && typeof inbound0 === "object" && (inbound0 as any).idempotencyKey);
    if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      throw new Error("Side-effect HTTP requests (POST/PUT/PATCH) require idempotencyKey in config or input");
    }
  }

  const timeout = config.timeout ?? 30000;
  const hasAllowlist = allowOnly.length > 0;
  const followRedirects = !hasAllowlist && (config.followRedirects !== false);

  const sanitizedHeaders = stripSensitiveHeaders((headers && typeof headers === "object" ? headers : {}) as Record<string, string>);
  const idempotencyKey = config.idempotencyKey ?? (inbound0 && typeof inbound0 === "object" ? (inbound0 as any).idempotencyKey : undefined);
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...sanitizedHeaders,
  };
  if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    requestHeaders["Idempotency-Key"] = idempotencyKey.trim();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: controller.signal,
      redirect: hasAllowlist ? "manual" : (followRedirects ? "follow" : "manual"),
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
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
    // Input node format - return as-is; consumers can extract value
    if ("value" in obj && "question" in obj) return v;
  }
  return v;
}

const conditionHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const value = inbound[0];

  const operator = config.operator || "truthy";
  const compareValue = config.compareValue;
  const humanCondition = config.humanCondition; // New: human-readable condition text

  let result: boolean | undefined = undefined;

  // If human-readable condition is provided, use AI evaluation
  if (humanCondition && typeof humanCondition === "string" && humanCondition.trim()) {
    const apiKey = getApiKey(node, ctx);
    if (apiKey) {
      try {
        const aiResult = await evaluateConditionWithAI(humanCondition.trim(), value, apiKey);
        result = aiResult.result;
        console.warn(`[Condition Node ${node.id}] AI evaluation: "${humanCondition}" = ${result} (confidence: ${aiResult.confidence})`);
      } catch (err) {
        console.error(`[Condition Node ${node.id}] AI evaluation failed, falling back to operator:`, err);
        // Fall through to operator-based evaluation
        result = undefined;
      }
    }
  }

  // Fallback to operator-based evaluation (or if AI evaluation failed)
  if (result === undefined) {
    switch (operator) {
      case "truthy":
        result = Boolean(value);
        break;
      case "falsy":
        result = !Boolean(value);
        break;
      case "equals":
        result = String(value) === String(compareValue);
        break;
      case "notEquals":
        result = String(value) !== String(compareValue);
        break;
      case "gt":
        result = Number(value) > Number(compareValue);
        break;
      case "lt":
        result = Number(value) < Number(compareValue);
        break;
      default:
        result = Boolean(value);
    }
  }

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

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(duration, 600000))));

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
            if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
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
    if (content !== null && content !== undefined && typeof content === "object" && !Array.isArray(content)) {
      data = { ...data, ...(content as Record<string, unknown>) };
    }
  }
  const result = String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null ? "" : String(val);
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
      ...(item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : { value: item }),
    };
    return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = data[key];
      return val === undefined || val === null ? "" : String(val);
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
  "openai-chat": openaiChatHandler,
  "openai-embeddings": openaiEmbeddingsHandler,
  "openai-image": openaiImageHandler,
  "http-request": httpRequestHandler,
  "json-parse": jsonParseHandler,
  condition: conditionHandler,
  delay: delayHandler,
  loop: loopHandler,
};
