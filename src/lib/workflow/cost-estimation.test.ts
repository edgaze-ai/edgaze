import { describe, expect, it } from "vitest";
import { getMinimumWorkflowPrice } from "./cost-estimation";

describe("workflow cost estimation pricing floors", () => {
  it("keeps the minimum workflow price at $5 even when infrastructure guidance is higher", () => {
    const expensiveGraph = {
      nodes: [
        {
          id: "image",
          data: {
            specId: "llm-image",
            config: {
              model: "gpt-image-2",
              quality: "high",
              aspectRatio: "16:9",
              prompt: "Render a premium campaign image.",
            },
          },
        },
      ],
      edges: [],
    };

    expect(getMinimumWorkflowPrice(expensiveGraph)).toBe(5);
  });
});
