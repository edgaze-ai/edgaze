import { describe, expect, it } from "vitest";

import { normalizeWorkflowMarkdown } from "./normalize-workflow-markdown";

describe("normalizeWorkflowMarkdown", () => {
  it("inserts GFM separator after header when model omits it", () => {
    const raw = ["Día | Idea | Tipo", '1 | "Hello" | Educativo', '2 | "World" | Viral'].join("\n");
    const out = normalizeWorkflowMarkdown(raw);
    expect(out).toContain("--- | --- | ---");
    expect(out.split("\n")[1]?.trim()).toBe("--- | --- | ---");
  });

  it("does not modify fenced code blocks", () => {
    const raw = "```\na | b\nc | d\n```";
    expect(normalizeWorkflowMarkdown(raw)).toBe(raw.replace(/\r\n/g, "\n"));
  });

  it("leaves valid GFM tables unchanged", () => {
    const raw = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    expect(normalizeWorkflowMarkdown(raw)).toBe(raw);
  });
});
