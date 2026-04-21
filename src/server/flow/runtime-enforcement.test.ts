import { beforeEach, describe, expect, it, vi } from "vitest";

const executionMocks = vi.hoisted(() => ({
  countUserTerminalRunsForCap: vi.fn(),
  getUserWorkflowRunCount: vi.fn(),
  isAdmin: vi.fn(),
  getWorkflowDraftId: vi.fn(),
  workflowExists: vi.fn(),
}));

const keyMocks = vi.hoisted(() => ({
  getEdgazeApiKey: vi.fn(),
  hasEdgazeApiKey: vi.fn(),
  hasEdgazeAnthropicApiKey: vi.fn(),
  hasEdgazeGeminiApiKey: vi.fn(),
}));

const specMocks = vi.hoisted(() => ({
  canonicalSpecId: vi.fn((specId: string) => specId),
  isPremiumAiSpec: vi.fn((specId: string) => specId === "llm-chat" || specId === "google-ai"),
  resolvePremiumKeyProvider: vi.fn((node: { data?: { specId?: string } }) => {
    if (node.data?.specId === "google-ai") return "google";
    return "openai";
  }),
}));

vi.mock("../../lib/supabase/executions", () => executionMocks);
vi.mock("../../lib/workflow/edgaze-api-key", () => keyMocks);
vi.mock("../../lib/workflow/spec-id-aliases", () => specMocks);

import { demoTierPlatformKeyFlags, enforceRuntimeLimits } from "./runtime-enforcement";

describe("runtime enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    executionMocks.countUserTerminalRunsForCap.mockResolvedValue(0);
    executionMocks.getUserWorkflowRunCount.mockResolvedValue(0);
    executionMocks.isAdmin.mockResolvedValue(false);
    executionMocks.getWorkflowDraftId.mockResolvedValue(null);
    executionMocks.workflowExists.mockResolvedValue(true);

    keyMocks.getEdgazeApiKey.mockReturnValue("edgaze-openai-key");
    keyMocks.hasEdgazeApiKey.mockReturnValue(true);
    keyMocks.hasEdgazeAnthropicApiKey.mockReturnValue(false);
    keyMocks.hasEdgazeGeminiApiKey.mockReturnValue(true);
  });

  it("uses platform keys during free runs for premium nodes", async () => {
    const result = await enforceRuntimeLimits({
      userId: "user_1",
      workflowId: "wf_1",
      nodes: [{ id: "chat_1", data: { specId: "llm-chat" } }],
    });

    expect(result.allowed).toBe(true);
    expect(result.requiresApiKeys).toEqual([]);
    expect(result.freeRunsRemaining).toBe(10);
    expect(result.useEdgazeKey).toBe(true);
    expect(result.useEdgazeOpenAI).toBe(true);
    expect(result.useEdgazeAnthropic).toBe(false);
  });

  it("requires user API keys once free runs are exhausted", async () => {
    executionMocks.getUserWorkflowRunCount.mockResolvedValue(10);

    const result = await enforceRuntimeLimits({
      userId: "user_1",
      workflowId: "wf_1",
      nodes: [{ id: "chat_1", data: { specId: "llm-chat", config: {} } }],
      userApiKeys: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApiKeys).toEqual(["chat_1"]);
    expect(result.error).toMatch(/free runs/i);
    expect(result.useEdgazeKey).toBe(false);
  });

  it("blocks users that exceed the hard per-workflow cap", async () => {
    executionMocks.getUserWorkflowRunCount.mockResolvedValue(100);

    const result = await enforceRuntimeLimits({
      userId: "user_1",
      workflowId: "wf_1",
      nodes: [{ id: "chat_1", data: { specId: "llm-chat" } }],
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/maximum runs \(100\)/i);
  });

  it("routes demo llm-chat runs to Gemini when a Google-only node is present", () => {
    const result = demoTierPlatformKeyFlags([
      { id: "chat_1", data: { specId: "llm-chat" } },
      { id: "google_1", data: { specId: "google-ai" } },
    ]);

    expect(result.useEdgazeKey).toBe(true);
    expect(result.useEdgazeOpenAI).toBe(true);
    expect(result.useEdgazeGemini).toBe(true);
  });
});
