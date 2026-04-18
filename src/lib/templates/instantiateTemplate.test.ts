import { describe, expect, it } from "vitest";
import { instantiateTemplate } from "./instantiateTemplate";
import { TEMPLATE_REGISTRY } from "./registry";

describe("instantiateTemplate", () => {
  it("expands the ai art creator template with merge-aware input routing", async () => {
    const template = TEMPLATE_REGISTRY.find((candidate) => candidate.id === "ai-art-creator");
    expect(template).toBeTruthy();

    const result = await instantiateTemplate({
      template: template!,
      answers: {
        inputCount: 5,
        inputQuestion1: "What is the core subject?",
        inputType1: "text",
        inputQuestion2: "Which art style should it follow?",
        inputType2: "textarea",
        inputQuestion3: "What mood should it have?",
        inputType3: "text",
        inputQuestion4: "What composition should it use?",
        inputType4: "text",
        inputQuestion5: "Any negative constraints?",
        inputType5: "textarea",
        imagePrompt: "styling consistency and dramatic lighting",
        imageModel: "gpt-image-1.5",
        aspectRatio: "9:16",
      },
      context: { mode: "template_page" },
    });

    const inputs = result.graph.nodes.filter((node) => node.data?.specId === "input");
    expect(inputs).toHaveLength(5);
    expect(result.graph.nodes.find((node) => node.id === "merge-secondary")).toBeTruthy();
    expect(result.graph.edges.filter((edge) => edge.target === "merge-primary")).toHaveLength(3);
    expect(result.graph.edges.filter((edge) => edge.target === "merge-secondary")).toHaveLength(3);

    const promptOptimizer = result.graph.nodes.find((node) => node.id === "prompt-optimizer");
    const imageGenerator = result.graph.nodes.find((node) => node.id === "image-generator");

    expect(promptOptimizer?.data?.config?.prompt).toContain(
      "styling consistency and dramatic lighting",
    );
    expect(imageGenerator?.data?.config?.prompt).toContain(
      "Take the prompt and generate the image.",
    );
    expect(imageGenerator?.data?.config?.model).toBe("gpt-image-1.5");
    expect(imageGenerator?.data?.config?.aspectRatio).toBe("9:16");
    expect(inputs[3]?.data?.config?.question).toBe("What composition should it use?");
    expect(inputs[4]?.data?.config?.inputType).toBe("textarea");
    expect(result.graph.meta.sourceTemplateId).toBe("ai-art-creator");
  });

  it("removes the second merge when three or fewer inputs are chosen", async () => {
    const template = TEMPLATE_REGISTRY.find((candidate) => candidate.id === "ai-art-creator");
    const result = await instantiateTemplate({
      template: template!,
      answers: {
        inputCount: 3,
        inputQuestion1: "Input 1",
        inputType1: "text",
        inputQuestion2: "Input 2",
        inputType2: "text",
        inputQuestion3: "Input 3",
        inputType3: "text",
        imagePrompt: "clarity",
        imageModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "16:9",
      },
      context: { mode: "builder_modal" },
    });

    expect(result.graph.nodes.find((node) => node.id === "merge-secondary")).toBeFalsy();
    expect(
      result.graph.edges.some(
        (edge) => edge.source === "merge-primary" && edge.target === "prompt-optimizer",
      ),
    ).toBe(true);
  });

  it("rejects invalid setup values", async () => {
    const template = TEMPLATE_REGISTRY.find((candidate) => candidate.id === "ai-art-creator");
    await expect(
      instantiateTemplate({
        template: template!,
        answers: { inputCount: 99 },
        context: { mode: "builder_modal" },
      }),
    ).rejects.toThrow(/supports up to five inputs/i);
  });
});
