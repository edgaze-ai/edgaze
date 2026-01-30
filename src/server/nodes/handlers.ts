import type { GraphNode, NodeRuntimeHandler, RuntimeContext } from "../flow/types";
import {
  countChatTokens,
  countEmbeddingTokens,
  countImageTokens,
  validateNodeTokenLimit,
} from "../../lib/workflow/token-counting";
import { getTokenLimits } from "../../lib/workflow/token-limits";
import {
  checkImageGenerationAllowed,
  recordImageGeneration,
} from "../../lib/rate-limiting/image-generation";
import { evaluateConditionWithAI } from "../../lib/ai/condition-evaluator";

const inputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Input node: accepts workflow-level input data
  const external = ctx.inputs?.[node.id];
  
  // If external input is explicitly provided (including empty string), use it
  if (external !== undefined && external !== null) {
    ctx.setNodeOutput(node.id, external);
    return external;
  }
  
  // Fallback: use config value if provided
  const configValue = node.data?.config?.value ?? node.data?.config?.text ?? node.data?.config?.defaultValue;
  
  if (configValue !== undefined && configValue !== null && configValue !== "") {
    ctx.setNodeOutput(node.id, configValue);
    return configValue;
  }
  
  // If no value at all, output empty string (not null) so downstream nodes can detect it
  // Empty string will be handled by merge/openai-chat appropriately
  ctx.setNodeOutput(node.id, "");
  return "";
};

const mergeHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Merge node: combines multiple inputs intelligently
  // This node receives outputs from previous nodes (like ChatGPT) and combines them
  const inbound = ctx.getInboundValues(node.id);
  
  console.log(`[Merge Node ${node.id}] Received inbound values:`, inbound.map(v => ({
    type: typeof v,
    isArray: Array.isArray(v),
    preview: typeof v === "string" ? v.substring(0, 50) : Array.isArray(v) ? `Array[${v.length}]` : typeof v === "object" ? "Object" : String(v)
  })));
  
  // Filter out only null/undefined (preserve empty strings, 0, false, etc. - let downstream nodes decide)
  const valid = inbound.filter((v) => v !== null && v !== undefined);
  
  // If no valid inputs at all, return empty string (not null) so downstream nodes can detect it
  if (valid.length === 0) {
    console.log(`[Merge Node ${node.id}] No valid inputs, returning empty string`);
    ctx.setNodeOutput(node.id, "");
    return "";
  }
  
  // If only one input, pass it through directly (no merging needed)
  // Convert to string if it's not already, to ensure consistent output format
  if (valid.length === 1) {
    const single = valid[0];
    let output: string;
    if (typeof single === "string") {
      output = single;
    } else if (typeof single === "object") {
      // Try to extract string from common fields
      const obj = single as any;
      if (typeof obj.content === "string") {
        output = obj.content;
      } else if (typeof obj.text === "string") {
        output = obj.text;
      } else if (typeof obj.message === "string") {
        output = obj.message;
      } else {
        // Convert to JSON string
        try {
          output = JSON.stringify(single);
        } catch {
          output = String(single);
        }
      }
    } else {
      output = String(single);
    }
    console.log(`[Merge Node ${node.id}] Single input, passing through:`, output.substring(0, 100));
    ctx.setNodeOutput(node.id, output);
    return output;
  }
  
  // Multiple inputs: merge intelligently
  
  // Convert all inputs to strings first for consistent merging
  const stringInputs = valid.map(v => {
    if (typeof v === "string") {
      return v;
    } else if (typeof v === "object" && v !== null) {
      // Try to extract string from common fields
      const obj = v as any;
      if (typeof obj.content === "string") {
        return obj.content;
      } else if (typeof obj.text === "string") {
        return obj.text;
      } else if (typeof obj.message === "string") {
        return obj.message;
      } else if (Array.isArray(obj)) {
        return obj.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(" ");
      } else {
        // Convert object to JSON string
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      }
    } else {
      return String(v);
    }
  }).filter(s => s.trim().length > 0); // Filter out empty strings after conversion
  
  // Join all string inputs with space
  if (stringInputs.length > 0) {
    const merged = stringInputs.join(" ");
    console.log(`[Merge Node ${node.id}] Merged ${valid.length} inputs into string:`, merged.substring(0, 100));
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // If all are arrays, concatenate them
  if (valid.every((v) => Array.isArray(v))) {
    const merged = (valid as any[][]).flat();
    console.log(`[Merge Node ${node.id}] Merged arrays:`, merged.length, "items");
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // If all are objects, merge them (shallow)
  if (valid.every((v) => typeof v === "object" && !Array.isArray(v))) {
    const merged = Object.assign({}, ...(valid as Record<string, any>[]));
    console.log(`[Merge Node ${node.id}] Merged objects:`, Object.keys(merged).length, "keys");
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // Default: convert all to strings and join
  const defaultMerged = valid.map(v => {
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }).join(" ");
  
  console.log(`[Merge Node ${node.id}] Default merge (mixed types):`, defaultMerged.substring(0, 100));
  ctx.setNodeOutput(node.id, defaultMerged);
  return defaultMerged;
};

const outputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Output node: combines all connected inputs into final result
  const inbound = ctx.getInboundValues(node.id);
  
  // Filter out undefined/null
  const valid = inbound.filter((v) => v !== undefined && v !== null);
  
  if (valid.length === 0) {
    ctx.setNodeOutput(node.id, null);
    return null;
  }
  
  // If single input, return as-is
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

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  
  // Debug: log inbound values to help diagnose issues
  console.log(`[OpenAI Chat] Node ${node.id} received inbound values:`, inbound.length, inbound.map(v => typeof v === "string" ? `"${v.substring(0, 50)}${v.length > 50 ? "..." : ""}"` : typeof v));
  
  // Extract prompt/messages from inbound - BE LENIENT, convert ANYTHING to usable format
  let inboundString: string | undefined = undefined;
  let inboundMessages: any[] | undefined = undefined;
  
  // First: look for messages array (highest priority)
  for (const val of inbound) {
    if (val === null || val === undefined) continue;
    
    if (Array.isArray(val) && val.length > 0) {
      // Check if it's OpenAI messages format
      if (val.every((item: any) => item && typeof item === "object" && ("role" in item || "content" in item))) {
        inboundMessages = val;
        break;
      }
    }
    
    if (typeof val === "object" && !Array.isArray(val) && Array.isArray((val as any).messages)) {
      inboundMessages = (val as any).messages;
      break;
    }
  }
  
  // Second: extract ANY string value from inbound (be super lenient)
  if (!inboundMessages) {
    for (const val of inbound) {
      if (val === null || val === undefined) continue;
      
      // Strings - use directly, even if empty
      if (typeof val === "string") {
        inboundString = val; // Don't trim, use as-is
        break;
      }
      
      // Objects - check common fields
      if (typeof val === "object" && !Array.isArray(val)) {
        const obj = val as any;
        if (typeof obj.prompt === "string") {
          inboundString = obj.prompt;
          break;
        }
        if (typeof obj.content === "string") {
          inboundString = obj.content;
          break;
        }
        if (typeof obj.text === "string") {
          inboundString = obj.text;
          break;
        }
        if (typeof obj.message === "string") {
          inboundString = obj.message;
          break;
        }
        // Convert entire object to JSON string
        try {
          inboundString = JSON.stringify(val);
        } catch {
          inboundString = String(val);
        }
        break;
      }
      
      // Arrays - join into string
      if (Array.isArray(val)) {
        inboundString = val.map(v => {
          if (typeof v === "string") return v;
          if (typeof v === "object") {
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          }
          return String(v);
        }).join(" ");
        break;
      }
      
      // Anything else - convert to string
      inboundString = String(val);
      break;
    }
  }
  
  // Use inbound if available (even if empty string), otherwise fall back to config
  // Combine node prompt (from OpenAI block) + connected input (from input/merge): both go to OpenAI
  let prompt: string | undefined;
  const configPrompt = typeof config.prompt === "string" ? config.prompt.trim() || undefined : undefined;
  
  // Extract connection value: prefer inboundString if found, otherwise try inbound[0]
  let fromConnection: string | undefined = undefined;
  if (inboundString !== undefined) {
    // We found a string in the inbound values
    fromConnection = inboundString;
    console.log(`[OpenAI Chat ${node.id}] Using extracted inboundString:`, fromConnection.substring(0, 100));
  } else if (inbound.length > 0 && !inboundMessages) {
    // No string found yet, but we have inbound values - try to extract from first value
    const firstVal = inbound[0];
    console.log(`[OpenAI Chat ${node.id}] Extracting from first inbound value:`, {
      type: typeof firstVal,
      isArray: Array.isArray(firstVal),
      preview: typeof firstVal === "string" ? firstVal.substring(0, 50) : "non-string"
    });
    
    if (firstVal != null) {
      if (typeof firstVal === "string") {
        fromConnection = firstVal;
        console.log(`[OpenAI Chat ${node.id}] Using string value directly:`, fromConnection.substring(0, 100));
      } else if (typeof firstVal === "object") {
        // Try common fields first
        const obj = firstVal as any;
        if (typeof obj.prompt === "string") {
          fromConnection = obj.prompt;
        } else if (typeof obj.content === "string") {
          fromConnection = obj.content;
        } else if (typeof obj.text === "string") {
          fromConnection = obj.text;
        } else if (typeof obj.message === "string") {
          fromConnection = obj.message;
        } else {
          // Convert object to JSON string
          try {
            fromConnection = JSON.stringify(firstVal);
          } catch {
            fromConnection = String(firstVal);
          }
        }
        console.log(`[OpenAI Chat ${node.id}] Extracted from object:`, fromConnection?.substring(0, 100));
      } else {
        // Number, boolean, etc. - convert to string
        fromConnection = String(firstVal);
        console.log(`[OpenAI Chat ${node.id}] Converted to string:`, fromConnection);
      }
    }
  }
  
  // Log if we still don't have a connection value
  if (fromConnection === undefined && inbound.length > 0) {
    console.warn(`[OpenAI Chat ${node.id}] Could not extract string from inbound values:`, inbound.map(v => ({
      type: typeof v,
      isArray: Array.isArray(v),
      preview: typeof v === "string" ? v.substring(0, 50) : "non-string"
    })));
  }
  
  // Combine config prompt + connection value
  if (fromConnection !== undefined) {
    // We have a connection value - combine with config prompt if it exists
    // If both exist, combine them; if only connection exists, use it (even if empty string)
    if (configPrompt) {
      prompt = `${configPrompt}\n\n${fromConnection}`;
    } else {
      prompt = fromConnection; // Use connection value even if empty (let OpenAI handle it)
    }
    console.log(`[OpenAI Chat] Built prompt from connection:`, { 
      fromConnection: typeof fromConnection === "string" ? fromConnection.substring(0, 100) : String(fromConnection), 
      configPrompt, 
      prompt: typeof prompt === "string" ? prompt.substring(0, 100) : String(prompt) 
    });
  } else {
    // No connection value - use config prompt only
    prompt = configPrompt;
    console.log(`[OpenAI Chat] Using config prompt only:`, configPrompt?.substring(0, 100));
  }

  const userSystem = typeof config.system === "string" ? config.system.trim() || undefined : undefined;
  const messages = inboundMessages;
  
  // Server-side enforced system prompt (from env or default)
  const serverSystemPrompt = process.env.EDGAZE_SERVER_SYSTEM_PROMPT || 
    "You are a helpful AI assistant running in Edgaze workflows. Be concise, accurate, and follow user instructions carefully.";
  
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
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

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

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const text =
    (typeof inbound[0] === "string" ? (inbound[0] as string) : undefined) ||
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
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

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

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const prompt =
    (typeof inbound[0] === "string" ? (inbound[0] as string) : undefined) ||
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        n: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

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
  const inbound0 = inbound[0];
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

  // Security: validate host
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();

    // Check deny list
    const denyHosts = (config.denyHosts || "localhost,127.0.0.1").split(",").map((h: string) => h.trim().toLowerCase());
    if (denyHosts.includes(host)) {
      throw new Error(`Access denied: ${host} is in the deny list`);
    }

    // Check allow list if set
    const allowOnly = config.allowOnly ? (config.allowOnly as string).split(",").map((h: string) => h.trim().toLowerCase()) : [];
    if (allowOnly.length > 0 && !allowOnly.includes(host)) {
      throw new Error(`Access denied: ${host} is not in the allow list`);
    }
  } catch (err: any) {
    if (err.message.includes("Access denied")) throw err;
    throw new Error(`Invalid URL: ${err.message}`);
  }

  const method = (config.method || "GET").toUpperCase();
  const timeout = config.timeout ?? 30000;
  const followRedirects = config.followRedirects ?? true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      signal: controller.signal,
      redirect: followRedirects ? "follow" : "manual",
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    let responseData: any;

    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
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
  const input = inbound[0];

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
        console.log(`[Condition Node ${node.id}] AI evaluation: "${humanCondition}" = ${result} (confidence: ${aiResult.confidence})`);
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

  ctx.setNodeOutput(node.id, result);
  return result;
};

const delayHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const duration = config.duration ?? 1000;

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(duration, 600000))));

  const value = inbound.length > 0 ? inbound[0] : null;
  ctx.setNodeOutput(node.id, value);
  return value;
};

const loopHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const array = inbound[0];

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

export const runtimeRegistry: Record<string, NodeRuntimeHandler> = {
  input: inputHandler,
  merge: mergeHandler,
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
