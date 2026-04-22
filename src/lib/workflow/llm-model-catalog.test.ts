import { describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_IMAGE_TIMEOUT_MS,
  LLM_IMAGE_MODEL_OPTIONS,
  resolveLlmImageProvider,
} from "./llm-model-catalog";

describe("llm-model-catalog image models", () => {
  it("includes gpt-image-2 as an OpenAI image option", () => {
    const model = LLM_IMAGE_MODEL_OPTIONS.find((option) => option.value === "gpt-image-2");

    expect(model).toBeTruthy();
    expect(model?.provider).toBe("openai");
  });

  it("routes gpt-image-2 to the OpenAI image provider", () => {
    expect(resolveLlmImageProvider("gpt-image-2")).toBe("openai");
  });

  it("uses a long enough default timeout for image generation", () => {
    expect(DEFAULT_LLM_IMAGE_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
  });
});
