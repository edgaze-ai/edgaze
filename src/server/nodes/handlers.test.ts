import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LLM_IMAGE_TIMEOUT_MS } from "../../lib/workflow/llm-model-catalog";
import { PREMIUM_NODES } from "../../nodes/premium";
import { runtimeRegistry } from "./handlers";
import type { GraphNode, RuntimeContext } from "../flow/types";

vi.mock("../../lib/workflow/token-limits", () => ({
  DEFAULT_MAX_TOKENS_PER_WORKFLOW: 200_000,
  DEFAULT_MAX_TOKENS_PER_NODE: 50_000,
  getTokenLimits: vi.fn(async () => ({
    maxTokensPerWorkflow: 200_000,
    maxTokensPerNode: 50_000,
  })),
}));

vi.mock("../../lib/rate-limiting/image-generation", () => ({
  checkImageGenerationAllowed: vi.fn(async () => ({ allowed: true, requiresApiKey: false })),
  recordImageGeneration: vi.fn(async () => undefined),
}));

vi.mock("../../lib/workflow/provider-rate-limits", () => ({
  checkProviderRateLimit: vi.fn(async () => ({ allowed: true })),
  recordProviderUsage: vi.fn(async () => undefined),
  record429Cooldown: vi.fn(),
}));

vi.mock("../../lib/workflow/edgaze-api-key", () => ({
  getEdgazeGeminiApiKey: vi.fn(() => "test-gemini-key"),
}));

vi.mock("youtube-transcript/dist/youtube-transcript.esm.js", () => ({
  fetchTranscript: vi.fn(),
}));

describe("llm-image handler", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends gpt-image-2 through the local OpenAI image generation path", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ data: [{ b64_json: "abc123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    const outputs = new Map<string, unknown>();
    const node: GraphNode = {
      id: "image-node",
      data: {
        specId: "llm-image",
        title: "Image",
        config: {
          model: "gpt-image-2",
          aspectRatio: "1:1",
          quality: "medium",
          timeout: DEFAULT_LLM_IMAGE_TIMEOUT_MS,
        },
      },
    };
    const ctx: RuntimeContext = {
      getInboundValues: () => ["Render a small test image"],
      setNodeOutput: (nodeId, value) => outputs.set(nodeId, value),
      inputs: {
        "__api_key_image-node": "test-openai-key",
      },
      requestMetadata: {
        userId: "user_123",
        identifier: "user_123",
        identifierType: "user",
      },
    };

    const result = await runtimeRegistry["llm-image"](node, ctx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/images/generations");
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body).toMatchObject({
      model: "gpt-image-2",
      prompt: "Render a small test image",
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });
    expect(result).toBe("data:image/png;base64,abc123");
    expect(outputs.get("image-node")).toBe("data:image/png;base64,abc123");
  });

  it("keeps the llm-image node default timeout aligned with the runtime timeout floor", () => {
    const spec = PREMIUM_NODES.find((candidate) => candidate.id === "llm-image");
    expect(spec?.defaultConfig?.timeout).toBe(DEFAULT_LLM_IMAGE_TIMEOUT_MS);
  });

  it("falls back to Nano Banana when the primary image provider fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://api.openai.com/v1/images/generations") {
        return new Response("upstream failure", { status: 500 });
      }
      expect(url).toContain("gemini-3.1-flash-image-preview");
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "gemini123",
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    global.fetch = fetchMock as typeof fetch;

    const outputs = new Map<string, unknown>();
    const node: GraphNode = {
      id: "image-node",
      data: {
        specId: "llm-image",
        title: "Image",
        config: {
          model: "gpt-image-2",
          aspectRatio: "1:1",
          quality: "medium",
          timeout: DEFAULT_LLM_IMAGE_TIMEOUT_MS,
        },
      },
    };
    const ctx: RuntimeContext = {
      getInboundValues: () => ["Render a fallback test image"],
      setNodeOutput: (nodeId, value) => outputs.set(nodeId, value),
      inputs: {
        "__api_key_image-node": "test-openai-key",
      },
      requestMetadata: {
        userId: "user_123",
        identifier: "user_123",
        identifierType: "user",
      },
    };

    const result = await runtimeRegistry["llm-image"](node, ctx);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/images/generations");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
    );
    expect(result).toBe("data:image/png;base64,gemini123");
    expect(outputs.get("image-node")).toBe("data:image/png;base64,gemini123");
  });
});
