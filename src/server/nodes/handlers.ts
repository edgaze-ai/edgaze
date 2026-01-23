import type { GraphNode, NodeRuntimeHandler, RuntimeContext } from "../flow/types";

const inputHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Input node: accepts workflow-level input data
  const external = ctx.inputs?.[node.id];
  if (external !== undefined) {
    ctx.setNodeOutput(node.id, external);
    return external;
  }
  // Fallback: use config value if provided
  const value =
    node.data?.config?.value ??
    node.data?.config?.text ??
    node.data?.config?.defaultValue ??
    "";
  ctx.setNodeOutput(node.id, value);
  return value;
};

const mergeHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  // Merge node: combines multiple inputs intelligently
  const inbound = ctx.getInboundValues(node.id);
  
  // Filter out null/undefined/empty strings
  const valid = inbound.filter((v) => v !== null && v !== undefined && `${v}`.trim() !== "");
  
  if (valid.length === 0) {
    ctx.setNodeOutput(node.id, null);
    return null;
  }
  
  // If all are strings, join them with space
  if (valid.every((v) => typeof v === "string")) {
    const merged = (valid as string[]).join(" ");
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // If all are arrays, concatenate them
  if (valid.every((v) => Array.isArray(v))) {
    const merged = (valid as any[][]).flat();
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // If all are objects, merge them (shallow)
  if (valid.every((v) => typeof v === "object" && !Array.isArray(v))) {
    const merged = Object.assign({}, ...(valid as Record<string, any>[]));
    ctx.setNodeOutput(node.id, merged);
    return merged;
  }
  
  // Default: return as array
  ctx.setNodeOutput(node.id, valid);
  return valid;
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
  const key = ctx.inputs?.[`__api_key_${node.id}`];
  if (typeof key === "string" && key.trim()) return key.trim();
  return null;
};

const openaiChatHandler: NodeRuntimeHandler = async (node: GraphNode, ctx: RuntimeContext) => {
  const apiKey = getApiKey(node, ctx);
  if (!apiKey) {
    throw new Error("OpenAI API key required. Please provide your API key in the run modal.");
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const inboundValue = inbound[0];
  const prompt =
    (typeof inboundValue === "string" ? inboundValue : undefined) ||
    (typeof config.prompt === "string" ? config.prompt : undefined);
  const system = typeof config.system === "string" ? config.system : undefined;
  const messages = Array.isArray(inboundValue) ? (inboundValue as any[]) : undefined;

  if (!prompt && !messages) {
    throw new Error("Prompt or messages array required");
  }

  const model = config.model || "gpt-4";
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 2000;
  const stream = config.stream ?? false;

  const requestBody: any = {
    model,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  if (messages && Array.isArray(messages)) {
    requestBody.messages = messages;
  } else {
    const messageList: any[] = [];
    if (system) {
      messageList.push({ role: "system", content: system });
    }
    messageList.push({ role: "user", content: prompt });
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
    const result = {
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage,
      finishReason: data.choices?.[0]?.finish_reason,
    };

    ctx.setNodeOutput(node.id, result);
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
  if (!apiKey) {
    throw new Error("OpenAI API key required");
  }

  const config = node.data?.config ?? {};
  const inbound = ctx.getInboundValues(node.id);
  const prompt =
    (typeof inbound[0] === "string" ? (inbound[0] as string) : undefined) ||
    (typeof config.prompt === "string" ? config.prompt : undefined);

  if (!prompt) {
    throw new Error("Prompt required for image generation");
  }

  const model = config.model || "dall-e-3";
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
  let result: boolean;

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
