/**
 * Quick-start workflow templates for the Block Library.
 * Each template is a prefilled graph using premium nodes (openai-chat, openai-image).
 * Input nodes are empty (user fills at run time). Generous spacing so connections are visible.
 */

const NODE_SPACING = 840; // horizontal gap between nodes so edges are clearly visible without panning

export type QuickStartTemplate = {
  id: string;
  title: string;
  caption: string;
  graph: { nodes: any[]; edges: any[] };
};

function node(
  id: string,
  specId: string,
  position: { x: number; y: number },
  data: { title: string; summary: string; config: Record<string, any>; type?: string }
) {
  const nodeType = data.type ?? "edgCard";
  return {
    id,
    type: nodeType,
    position,
    data: {
      specId,
      title: data.title,
      version: "1.0.0",
      summary: data.summary,
      config: data.config,
      connectedNames: [],
    },
  };
}

function edge(source: string, target: string, sourceHandle?: string, targetHandle?: string) {
  const id = `e-${source}-${target}`;
  const e: any = { id, source, target };
  if (sourceHandle) e.sourceHandle = sourceHandle;
  if (targetHandle) e.targetHandle = targetHandle;
  e.type = "default";
  return e;
}

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "email-parser",
    title: "Email Parser",
    caption: "Turn emails into structured data.",
    graph: {
      nodes: [
        node("input-1", "input", { x: 0, y: 0 }, {
          title: "Input",
          summary: "Accepts user / frontend data into the workflow.",
          config: {
            nickname: "Email",
            inputType: "textarea",
            placeholder: "Paste an email to extract structured data…",
            required: true,
            defaultValue: "",
            helpText: "Paste an email to extract structured data.",
          },
        }),
        node("openai-chat-1", "openai-chat", { x: NODE_SPACING, y: 0 }, {
          title: "OpenAI Chat",
          summary: "Generate text completions using OpenAI's GPT models.",
          config: {
            system:
              "Extract structured data from the email. Output valid JSON with keys: from, subject, date, body, summary. If a field is missing, use null.",
            prompt: "Extract structured data from this email.",
            model: "gpt-4o-mini",
            temperature: 0.3,
            maxTokens: 2000,
            stream: false,
            safeMode: true,
            timeout: 30000,
            retries: 2,
          },
        }),
        node("output-1", "output", { x: NODE_SPACING * 2, y: 0 }, {
          title: "Output",
          summary: "Displays or returns data to the frontend.",
          config: {},
        }),
      ],
      edges: [
        edge("input-1", "openai-chat-1", "data", "in"),
        edge("openai-chat-1", "output-1", "out", "data"),
      ],
    },
  },
  {
    id: "writer",
    title: "Writer",
    caption: "Generate posts with AI.",
    graph: {
      nodes: [
        node("input-1", "input", { x: 0, y: 0 }, {
          title: "Input",
          summary: "Accepts user / frontend data into the workflow.",
          config: {
            nickname: "Topic",
            inputType: "text",
            placeholder: "e.g. 5 tips for remote work",
            required: true,
            defaultValue: "",
            helpText: "Enter a topic for the post.",
          },
        }),
        node("openai-chat-1", "openai-chat", { x: NODE_SPACING, y: 0 }, {
          title: "OpenAI Chat",
          summary: "Generate text completions using OpenAI's GPT models.",
          config: {
            system:
              "You are a social media writer. Write engaging, concise posts. Keep tone friendly and actionable.",
            prompt: "Write a short engaging post about the following topic. Use the input as the topic.",
            model: "gpt-4o-mini",
            temperature: 0.7,
            maxTokens: 500,
            stream: false,
            safeMode: true,
            timeout: 30000,
            retries: 2,
          },
        }),
        node("output-1", "output", { x: NODE_SPACING * 2, y: 0 }, {
          title: "Output",
          summary: "Displays or returns data to the frontend.",
          config: {},
        }),
      ],
      edges: [
        edge("input-1", "openai-chat-1", "data", "in"),
        edge("openai-chat-1", "output-1", "out", "data"),
      ],
    },
  },
  {
    id: "images",
    title: "Images",
    caption: "Text-to-image generation.",
    graph: {
      nodes: [
        node("input-1", "input", { x: 0, y: 0 }, {
          title: "Input",
          summary: "Accepts user / frontend data into the workflow.",
          config: {
            nickname: "Prompt",
            inputType: "text",
            placeholder: "Describe the image you want…",
            required: true,
            defaultValue: "",
            helpText: "Describe the image you want to generate.",
          },
        }),
        node("openai-image-1", "openai-image", { x: NODE_SPACING, y: 0 }, {
          title: "OpenAI Image",
          summary: "Generate images using DALL-E.",
          config: {
            prompt: "A beautiful landscape",
            model: "dall-e-3",
            size: "1024x1024",
            quality: "standard",
            n: 1,
            timeout: 60000,
            retries: 2,
          },
        }),
        node("output-1", "output", { x: NODE_SPACING * 2, y: 0 }, {
          title: "Output",
          summary: "Displays or returns data to the frontend.",
          config: {},
        }),
      ],
      edges: [
        edge("input-1", "openai-image-1", "data", "in"),
        edge("openai-image-1", "output-1", "out", "data"),
      ],
    },
  },
];

export function getQuickStartTemplate(id: string): QuickStartTemplate | null {
  return QUICK_START_TEMPLATES.find((t) => t.id === id) ?? null;
}
