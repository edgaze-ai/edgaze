import type { Edge, Node } from "reactflow";
import type { TemplateDefinition } from "./types";
import {
  LLM_IMAGE_ASPECT_OPTIONS,
  LLM_IMAGE_MODEL_OPTIONS,
} from "@/lib/workflow/llm-model-catalog";
import { getNodeSpec } from "@/nodes/registry";

function createNode(
  id: string,
  specId: string,
  position: { x: number; y: number },
  config: Record<string, unknown>,
  options?: { title?: string; type?: string; summary?: string },
): Node {
  const spec = getNodeSpec(specId);
  return {
    id,
    type: options?.type ?? spec?.nodeType ?? "edgCard",
    position,
    data: {
      specId,
      title: options?.title ?? spec?.label ?? specId,
      version: spec?.version ?? "1.0.0",
      summary: options?.summary ?? spec?.summary ?? "",
      config: {
        ...(spec?.defaultConfig ?? {}),
        ...config,
      },
      connectedNames: [],
    },
  };
}

function createEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string,
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: "default",
  };
}

const aiArtCreatorGraph = {
  nodes: [
    createNode(
      "input-base",
      "input",
      { x: 0, y: -220 },
      {
        question: "What should input 1 capture?",
        description: "",
        inputType: "text",
      },
      { title: "Input 1", summary: "Collects the first creative direction signal." },
    ),
    createNode(
      "merge-primary",
      "merge",
      { x: 300, y: -40 },
      {},
      {
        title: "Merge",
        type: "edgMerge",
        summary: "Combines the first set of inspiration inputs.",
      },
    ),
    createNode(
      "merge-secondary",
      "merge",
      { x: 640, y: 140 },
      {},
      {
        title: "Merge",
        type: "edgMerge",
        summary: "Extends the graph when more than three inputs are needed.",
      },
    ),
    createNode(
      "prompt-optimizer",
      "llm-chat",
      { x: 980, y: 40 },
      {
        system: "Take these inputs and optimize this prompt and give the final prompt.",
        prompt:
          "Take the merged creative inputs, optimize them into one final image prompt, and focus on {{optimizerFocus}}. Return only the final prompt.",
        model: "claude-sonnet-4-5",
        temperature: 0.7,
        maxTokens: 1200,
        stream: true,
        safeMode: true,
      },
      { title: "Prompt Optimizer", summary: "Shapes rough cues into one image-ready prompt." },
    ),
    createNode(
      "image-generator",
      "llm-image",
      { x: 1300, y: 40 },
      {
        prompt: "Take the prompt and generate the image.",
        model: "gemini-3.1-flash-image-preview",
        aspectRatio: "16:9",
        quality: "high",
        n: 1,
      },
      { title: "Image Generator", summary: "Produces the final visual output." },
    ),
    createNode(
      "output-final",
      "output",
      { x: 1620, y: 40 },
      {
        name: "Generated images",
        format: "text",
      },
      { title: "Output", summary: "Returns the generated result to the user." },
    ),
  ],
  edges: [
    createEdge("e-input-merge", "input-base", "merge-primary", "out-right", "in-1"),
    createEdge("e-primary-secondary", "merge-primary", "merge-secondary", "out", "in-1"),
    createEdge("e-secondary-optimizer", "merge-secondary", "prompt-optimizer", "out", "in"),
    createEdge("e-optimizer-image", "prompt-optimizer", "image-generator", "out", "in"),
    createEdge("e-image-output", "image-generator", "output-final", "out", "in-left"),
  ],
};

const aiArtCreatorPreviewGraph = {
  nodes: [
    createNode(
      "preview-input-1",
      "input",
      { x: 0, y: -220 },
      { question: "Input 1", inputType: "text" },
      { title: "Input 1" },
    ),
    createNode(
      "preview-input-2",
      "input",
      { x: 0, y: -40 },
      { question: "Input 2", inputType: "text" },
      { title: "Input 2" },
    ),
    createNode(
      "preview-input-3",
      "input",
      { x: 0, y: 140 },
      { question: "Input 3", inputType: "text" },
      { title: "Input 3" },
    ),
    createNode(
      "preview-input-4",
      "input",
      { x: 340, y: 50 },
      { question: "Input 4", inputType: "text" },
      { title: "Input 4" },
    ),
    createNode(
      "preview-input-5",
      "input",
      { x: 340, y: 230 },
      { question: "Input 5", inputType: "text" },
      { title: "Input 5" },
    ),
    createNode(
      "preview-merge-primary",
      "merge",
      { x: 300, y: -40 },
      {},
      { title: "Merge", type: "edgMerge" },
    ),
    createNode(
      "preview-merge-secondary",
      "merge",
      { x: 640, y: 140 },
      {},
      { title: "Merge", type: "edgMerge" },
    ),
    createNode(
      "preview-prompt-optimizer",
      "llm-chat",
      { x: 980, y: 40 },
      {},
      { title: "Prompt Optimizer" },
    ),
    createNode(
      "preview-image-generator",
      "llm-image",
      { x: 1300, y: 40 },
      {},
      { title: "Image Generator" },
    ),
    createNode("preview-output-final", "output", { x: 1620, y: 40 }, {}, { title: "Output" }),
  ],
  edges: [
    createEdge("preview-e1", "preview-input-1", "preview-merge-primary", "out-right", "in-1"),
    createEdge("preview-e2", "preview-input-2", "preview-merge-primary", "out-right", "in-2"),
    createEdge("preview-e3", "preview-input-3", "preview-merge-primary", "out-right", "in-3"),
    createEdge("preview-e4", "preview-merge-primary", "preview-merge-secondary", "out", "in-1"),
    createEdge("preview-e5", "preview-input-4", "preview-merge-secondary", "out-right", "in-2"),
    createEdge("preview-e6", "preview-input-5", "preview-merge-secondary", "out-right", "in-3"),
    createEdge("preview-e7", "preview-merge-secondary", "preview-prompt-optimizer", "out", "in"),
    createEdge("preview-e8", "preview-prompt-optimizer", "preview-image-generator", "out", "in"),
    createEdge("preview-e9", "preview-image-generator", "preview-output-final", "out", "in-left"),
  ],
};

const emailParserGraph = {
  nodes: [
    createNode(
      "email-input",
      "input",
      { x: 0, y: 0 },
      {
        question: "Which email should this workflow parse?",
        description: "Paste the email body or thread excerpt.",
        inputType: "textarea",
      },
      { title: "Email Input", summary: "Captures the raw email content." },
    ),
    createNode(
      "email-parse",
      "llm-chat",
      { x: 340, y: 0 },
      {
        system:
          "Extract structured email information. Return JSON with sender, subject, summary, nextSteps, sentiment, and urgency.",
        prompt: "Parse the incoming email into structured JSON with stable keys.",
        model: "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: 800,
        stream: true,
        safeMode: true,
      },
      { title: "Email Parser", summary: "Turns raw email text into structured data." },
    ),
    createNode(
      "email-output",
      "output",
      { x: 680, y: 0 },
      { name: "Parsed email", format: "json" },
      { title: "Output", summary: "Returns the structured result." },
    ),
  ],
  edges: [
    createEdge("e-email-input", "email-input", "email-parse", "out-right", "in"),
    createEdge("e-email-output", "email-parse", "email-output", "out", "in-left"),
  ],
};

const socialWriterGraph = {
  nodes: [
    createNode(
      "topic-input",
      "input",
      { x: 0, y: 0 },
      {
        question: "What is the post about?",
        description: "Provide the hook, idea, or campaign theme.",
        inputType: "text",
      },
      { title: "Topic", summary: "Captures the idea you want to publish about." },
    ),
    createNode(
      "writer",
      "llm-chat",
      { x: 340, y: 0 },
      {
        system:
          "You write premium social posts with a strong hook, clean rhythm, and one clear takeaway.",
        prompt: "Write a concise, publish-ready social post based on the incoming topic.",
        model: "claude-sonnet-4-5",
        temperature: 0.8,
        maxTokens: 700,
        stream: true,
        safeMode: true,
      },
      { title: "Social Writer", summary: "Creates a strong post from one brief." },
    ),
    createNode(
      "social-output",
      "output",
      { x: 680, y: 0 },
      { name: "Final post", format: "text" },
      { title: "Output", summary: "Returns the finished draft." },
    ),
  ],
  edges: [
    createEdge("e-topic-writer", "topic-input", "writer", "out-right", "in"),
    createEdge("e-writer-output", "writer", "social-output", "out", "in-left"),
  ],
};

const imageStarterGraph = {
  nodes: [
    createNode(
      "prompt-input",
      "input",
      { x: 0, y: 0 },
      {
        question: "What image should this workflow generate?",
        description: "Describe the desired scene or subject.",
        inputType: "text",
      },
      { title: "Prompt", summary: "Captures the initial image direction." },
    ),
    createNode(
      "image-model",
      "llm-image",
      { x: 360, y: 0 },
      {
        prompt: "Generate a polished image based on the incoming brief.",
        model: "gemini-3.1-flash-image-preview",
        aspectRatio: "1:1",
        quality: "medium",
        n: 1,
      },
      { title: "Image Generator", summary: "Turns the prompt into an image." },
    ),
    createNode(
      "image-output",
      "output",
      { x: 700, y: 0 },
      { name: "Generated image", format: "text" },
      { title: "Output", summary: "Returns the generated image URL." },
    ),
  ],
  edges: [
    createEdge("e-prompt-image", "prompt-input", "image-model", "out-right", "in"),
    createEdge("e-image-finish", "image-model", "image-output", "out", "in-left"),
  ],
};

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    id: "ai-art-creator",
    slug: "ai-art-creator",
    version: 1,
    status: "published",
    meta: {
      name: "AI Art Creator",
      shortDescription:
        "Turn a set of creative inputs into a polished AI art workflow with built-in prompt optimization.",
      longDescription:
        "A premium image-generation starter that collects up to five creative inputs, merges them into one guided prompt flow, upgrades the prompt with an LLM, and sends the refined brief into the image generator. The graph stays fully editable once it lands in the builder.",
      category: "image",
      tags: ["featured", "image", "prompting", "ai-art"],
      featured: true,
      icon: "Sparkles",
      estimatedSetupMinutes: 2,
      difficulty: "beginner",
      outcomes: ["AI art workflow"],
    },
    preview: {
      heroMode: "split",
      sampleOutputs: [
        {
          type: "text",
          value:
            "Refined final prompt with merged inputs, optimized structure, and ready-to-render image settings.",
        },
      ],
      graphLayout: aiArtCreatorPreviewGraph,
    },
    setup: {
      mode: "guided",
      submitLabel: "Create workflow",
      fields: [
        {
          id: "inputCount",
          type: "number",
          label: "How many inputs should this workflow use?",
          defaultValue: 5,
          min: 1,
          max: 5,
          step: 1,
          required: true,
          ui: { section: "Inputs", width: "half" },
        },
        {
          id: "inputQuestion1",
          type: "text",
          label: "Input 1 question",
          defaultValue: "",
          placeholder: "What should input 1 capture?",
          required: true,
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputCount", gte: 1 },
          },
        },
        {
          id: "inputType1",
          type: "select",
          label: "Input 1 format",
          defaultValue: "text",
          required: true,
          ui: {
            section: "Input nodes",
            width: "half",
            visibleWhen: { fieldId: "inputCount", gte: 1 },
          },
          options: [
            { label: "Text", value: "text" },
            { label: "Paragraph", value: "textarea" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        {
          id: "inputOptions1",
          type: "list",
          label: "Input 1 dropdown options",
          description:
            "Add the choices users can pick from. Each row becomes one dropdown option in the input node.",
          defaultValue: [""],
          required: true,
          placeholder: "Option label",
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputType1", equals: "dropdown" },
          },
        },
        {
          id: "inputQuestion2",
          type: "text",
          label: "Input 2 question",
          defaultValue: "",
          placeholder: "What should input 2 capture?",
          required: true,
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputCount", gte: 2 },
          },
        },
        {
          id: "inputType2",
          type: "select",
          label: "Input 2 format",
          defaultValue: "text",
          required: true,
          ui: {
            section: "Input nodes",
            width: "half",
            visibleWhen: { fieldId: "inputCount", gte: 2 },
          },
          options: [
            { label: "Text", value: "text" },
            { label: "Paragraph", value: "textarea" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        {
          id: "inputOptions2",
          type: "list",
          label: "Input 2 dropdown options",
          description:
            "Add the choices users can pick from. Each row becomes one dropdown option in the input node.",
          defaultValue: [""],
          required: true,
          placeholder: "Option label",
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputType2", equals: "dropdown" },
          },
        },
        {
          id: "inputQuestion3",
          type: "text",
          label: "Input 3 question",
          defaultValue: "",
          placeholder: "What should input 3 capture?",
          required: true,
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputCount", gte: 3 },
          },
        },
        {
          id: "inputType3",
          type: "select",
          label: "Input 3 format",
          defaultValue: "text",
          required: true,
          ui: {
            section: "Input nodes",
            width: "half",
            visibleWhen: { fieldId: "inputCount", gte: 3 },
          },
          options: [
            { label: "Text", value: "text" },
            { label: "Paragraph", value: "textarea" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        {
          id: "inputOptions3",
          type: "list",
          label: "Input 3 dropdown options",
          description:
            "Add the choices users can pick from. Each row becomes one dropdown option in the input node.",
          defaultValue: [""],
          required: true,
          placeholder: "Option label",
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputType3", equals: "dropdown" },
          },
        },
        {
          id: "inputQuestion4",
          type: "text",
          label: "Input 4 question",
          defaultValue: "",
          placeholder: "What should input 4 capture?",
          required: true,
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputCount", gte: 4 },
          },
        },
        {
          id: "inputType4",
          type: "select",
          label: "Input 4 format",
          defaultValue: "text",
          required: true,
          ui: {
            section: "Input nodes",
            width: "half",
            visibleWhen: { fieldId: "inputCount", gte: 4 },
          },
          options: [
            { label: "Text", value: "text" },
            { label: "Paragraph", value: "textarea" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        {
          id: "inputOptions4",
          type: "list",
          label: "Input 4 dropdown options",
          description:
            "Add the choices users can pick from. Each row becomes one dropdown option in the input node.",
          defaultValue: [""],
          required: true,
          placeholder: "Option label",
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputType4", equals: "dropdown" },
          },
        },
        {
          id: "inputQuestion5",
          type: "text",
          label: "Input 5 question",
          defaultValue: "",
          placeholder: "What should input 5 capture?",
          required: true,
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputCount", gte: 5 },
          },
        },
        {
          id: "inputType5",
          type: "select",
          label: "Input 5 format",
          defaultValue: "text",
          required: true,
          ui: {
            section: "Input nodes",
            width: "half",
            visibleWhen: { fieldId: "inputCount", gte: 5 },
          },
          options: [
            { label: "Text", value: "text" },
            { label: "Paragraph", value: "textarea" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        {
          id: "inputOptions5",
          type: "list",
          label: "Input 5 dropdown options",
          description:
            "Add the choices users can pick from. Each row becomes one dropdown option in the input node.",
          defaultValue: [""],
          required: true,
          placeholder: "Option label",
          ui: {
            section: "Input nodes",
            width: "full",
            visibleWhen: { fieldId: "inputType5", equals: "dropdown" },
          },
        },
        {
          id: "optimizerFocus",
          type: "textarea",
          label: "What should the prompt optimizer focus on?",
          defaultValue: "style consistency, mood, lighting, and clean composition",
          required: true,
          ui: { section: "Prompt optimization", width: "full" },
        },
        {
          id: "imageModel",
          type: "select",
          label: "Which image model should this use?",
          defaultValue: "gemini-3.1-flash-image-preview",
          required: true,
          ui: { section: "Image generation", width: "full" },
          options: LLM_IMAGE_MODEL_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
        {
          id: "aspectRatio",
          type: "select",
          label: "Choose the output shape",
          defaultValue: "16:9",
          required: true,
          ui: { section: "Image generation", width: "full" },
          options: LLM_IMAGE_ASPECT_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      ],
    },
    blueprint: {
      ...aiArtCreatorGraph,
      entryStrategy: "new_workflow",
      defaultViewport: { x: 90, y: 80, zoom: 0.72 },
    },
    instantiation: {
      variableBindings: [
        {
          fieldId: "optimizerFocus",
          target: { target: "node.config", nodeId: "prompt-optimizer", path: "prompt" },
        },
        {
          fieldId: "imageModel",
          target: { target: "node.config", nodeId: "image-generator", path: "model" },
        },
        {
          fieldId: "aspectRatio",
          target: { target: "node.config", nodeId: "image-generator", path: "aspectRatio" },
        },
        { fieldId: "aspectRatio", target: { target: "workflow.meta", path: "output.aspectRatio" } },
      ],
      validators: [
        { fieldId: "inputCount", kind: "min", value: 1, message: "Use at least one input." },
        {
          fieldId: "inputCount",
          kind: "max",
          value: 5,
          message: "This template supports up to five inputs.",
        },
      ],
      transforms: [
        {
          type: "ai_art_creator_inputs",
          countFromField: "inputCount",
          inputNodeId: "input-base",
          primaryMergeNodeId: "merge-primary",
          secondaryMergeNodeId: "merge-secondary",
          promptNodeId: "prompt-optimizer",
          imageNodeId: "image-generator",
          outputNodeId: "output-final",
          maxInputs: 5,
        },
      ],
    },
  },
  {
    id: "email-parser",
    slug: "email-parser",
    version: 1,
    status: "published",
    meta: {
      name: "Email Parser",
      shortDescription: "Turn raw emails into structured JSON you can route or publish later.",
      longDescription:
        "A clean extraction workflow for parsing inbox content into stable fields like sender, summary, urgency, and next steps.",
      category: "utility",
      tags: ["utility", "ops", "email"],
      estimatedSetupMinutes: 1,
      difficulty: "beginner",
      outcomes: ["Structured email JSON"],
    },
    preview: {
      heroMode: "graph",
      sampleOutputs: [{ type: "json", value: '{ "sender": "team@brand.com", "urgency": "high" }' }],
      graphLayout: emailParserGraph,
    },
    setup: {
      mode: "none",
      fields: [],
      submitLabel: "Use template",
    },
    blueprint: {
      ...emailParserGraph,
      entryStrategy: "new_workflow",
      defaultViewport: { x: 80, y: 140, zoom: 0.9 },
    },
    instantiation: {
      variableBindings: [],
      validators: [],
      transforms: [],
    },
  },
  {
    id: "social-writer",
    slug: "social-writer",
    version: 1,
    status: "published",
    meta: {
      name: "Social Writer",
      shortDescription: "Start from a topic and land on a publish-ready social post in one pass.",
      longDescription:
        "A lightweight writing workflow for hooks, launch posts, and creator updates. Good defaults, minimal setup, and easy to expand later.",
      category: "social",
      tags: ["social", "writing", "launch"],
      estimatedSetupMinutes: 1,
      difficulty: "beginner",
      outcomes: ["Publish-ready post copy"],
    },
    preview: {
      heroMode: "graph",
      sampleOutputs: [
        { type: "text", value: "One concise post with a sharper hook and takeaway." },
      ],
      graphLayout: socialWriterGraph,
    },
    setup: {
      mode: "none",
      fields: [],
      submitLabel: "Use template",
    },
    blueprint: {
      ...socialWriterGraph,
      entryStrategy: "new_workflow",
      defaultViewport: { x: 110, y: 120, zoom: 0.95 },
    },
    instantiation: {
      variableBindings: [],
      validators: [],
      transforms: [],
    },
  },
  {
    id: "image-starter",
    slug: "image-starter",
    version: 1,
    status: "published",
    meta: {
      name: "Image Starter",
      shortDescription: "A simple text-to-image workflow for quick visual generation experiments.",
      longDescription:
        "A minimal image workflow for creators who want a fast starting point without extra graph complexity.",
      category: "image",
      tags: ["image", "starter", "fast"],
      estimatedSetupMinutes: 1,
      difficulty: "beginner",
      outcomes: ["Simple image generation flow"],
    },
    preview: {
      heroMode: "graph",
      sampleOutputs: [{ type: "text", value: "One generated image URL with a clean output step." }],
      graphLayout: imageStarterGraph,
    },
    setup: {
      mode: "simple",
      submitLabel: "Create workflow",
      fields: [
        {
          id: "aspectRatio",
          type: "radio",
          label: "Choose the output shape",
          defaultValue: "1:1",
          required: true,
          options: [
            { label: "Square", value: "1:1" },
            { label: "Landscape", value: "16:9" },
            { label: "Portrait", value: "9:16" },
          ],
        },
      ],
    },
    blueprint: {
      ...imageStarterGraph,
      entryStrategy: "new_workflow",
      defaultViewport: { x: 120, y: 150, zoom: 0.92 },
    },
    instantiation: {
      variableBindings: [
        {
          fieldId: "aspectRatio",
          target: { target: "node.config", nodeId: "image-model", path: "aspectRatio" },
        },
      ],
      validators: [],
      transforms: [],
    },
  },
];
