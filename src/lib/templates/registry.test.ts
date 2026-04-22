import { describe, expect, it } from "vitest";
import { TEMPLATE_REGISTRY } from "./registry";

describe("template guided setup", () => {
  it("offers the latest image models while keeping Nano Banana as the default", () => {
    const template = TEMPLATE_REGISTRY.find((candidate) => candidate.id === "ai-art-creator");
    const imageModelField = template?.setup.fields.find((field) => field.id === "imageModel");

    expect(imageModelField).toBeTruthy();
    expect(imageModelField?.defaultValue).toBe("gemini-3.1-flash-image-preview");

    const optionValues = Array.isArray(imageModelField?.options)
      ? imageModelField.options.map((option) => option.value)
      : [];

    expect(optionValues).toContain("gpt-image-2");
    expect(optionValues).toContain("gemini-3.1-flash-image-preview");
  });
});
