/**
 * Quick-start workflow templates for the Block Library.
 * Each template is a prefilled graph using premium nodes (llm-chat, llm-image).
 * Input nodes are empty (user fills at run time). Spacing balances readable edges with sensible default zoom on fit-to-screen.
 */

const NODE_SPACING = 520; // horizontal gap — wide enough for edges; avoids microscopic nodes when fitting the canvas

export type QuickStartTemplate = {
  id: string;
  title: string;
  caption: string;
  graph: { nodes: any[]; edges: any[] };
};

export type PromptWorkflowStarterInput = {
  prompt: string;
  intent?: "custom" | "writing" | "image";
  title?: string;
};

function node(
  id: string,
  specId: string,
  position: { x: number; y: number },
  data: { title: string; summary: string; config: Record<string, any>; type?: string },
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
        node(
          "input-1",
          "input",
          { x: 0, y: 0 },
          {
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
          },
        ),
        node(
          "llm-chat-1",
          "llm-chat",
          { x: NODE_SPACING, y: 0 },
          {
            title: "LLM Chat",
            summary: "Generate text with OpenAI GPT models.",
            config: {
              system:
                "Extract structured data from the email. Output valid JSON with keys: from, subject, date, body, summary. If a field is missing, use null.",
              prompt: "Extract structured data from this email.",
              model: "gpt-4o-mini",
              temperature: 0.3,
              maxTokens: 2000,
              stream: true,
              safeMode: true,
              timeout: 30000,
              retries: 2,
            },
          },
        ),
        node(
          "output-1",
          "output",
          { x: NODE_SPACING * 2, y: 0 },
          {
            title: "Output",
            summary: "Displays or returns data to the frontend.",
            config: {},
          },
        ),
      ],
      edges: [
        edge("input-1", "llm-chat-1", "data", "in"),
        edge("llm-chat-1", "output-1", "out", "data"),
      ],
    },
  },
  {
    id: "writer",
    title: "Writer",
    caption: "Generate posts with AI.",
    graph: {
      nodes: [
        node(
          "input-1",
          "input",
          { x: 0, y: 0 },
          {
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
          },
        ),
        node(
          "llm-chat-1",
          "llm-chat",
          { x: NODE_SPACING, y: 0 },
          {
            title: "LLM Chat",
            summary: "Generate text with OpenAI GPT models.",
            config: {
              system:
                "You are a social media writer. Write engaging, concise posts. Keep tone friendly and actionable.",
              prompt:
                "Write a short engaging post about the following topic. Use the input as the topic.",
              model: "gpt-4o-mini",
              temperature: 0.7,
              maxTokens: 500,
              stream: true,
              safeMode: true,
              timeout: 30000,
              retries: 2,
            },
          },
        ),
        node(
          "output-1",
          "output",
          { x: NODE_SPACING * 2, y: 0 },
          {
            title: "Output",
            summary: "Displays or returns data to the frontend.",
            config: {},
          },
        ),
      ],
      edges: [
        edge("input-1", "llm-chat-1", "data", "in"),
        edge("llm-chat-1", "output-1", "out", "data"),
      ],
    },
  },
  {
    id: "images",
    title: "Images",
    caption: "Text-to-image generation.",
    graph: {
      nodes: [
        node(
          "input-1",
          "input",
          { x: 0, y: 0 },
          {
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
          },
        ),
        node(
          "llm-image-1",
          "llm-image",
          { x: NODE_SPACING, y: 0 },
          {
            title: "LLM Image",
            summary: "Generate images with Gemini or OpenAI.",
            config: {
              prompt: "A beautiful landscape",
              model: "gemini-3.1-flash-image-preview",
              aspectRatio: "16:9",
              quality: "medium",
              n: 1,
              timeout: 60000,
              retries: 2,
            },
          },
        ),
        node(
          "output-1",
          "output",
          { x: NODE_SPACING * 2, y: 0 },
          {
            title: "Output",
            summary: "Displays or returns data to the frontend.",
            config: {},
          },
        ),
      ],
      edges: [
        edge("input-1", "llm-image-1", "data", "in"),
        edge("llm-image-1", "output-1", "out", "data"),
      ],
    },
  },
];

export function getQuickStartTemplate(id: string): QuickStartTemplate | null {
  return QUICK_START_TEMPLATES.find((t) => t.id === id) ?? null;
}

function titleFromPrompt(prompt: string) {
  const firstLine = prompt
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Custom AI Workflow";
  return firstLine
    .replace(/^#+\s*/, "")
    .replace(/^(prompt|workflow|task)\s*:\s*/i, "")
    .slice(0, 58)
    .trim();
}

function sentenceCase(value: string) {
  const clean = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "Input";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function uniqueInputNamesFromPrompt(prompt: string) {
  const found = new Set<string>();
  const patterns = [
    /\{\{\s*([a-zA-Z][\w -]{1,34})\s*\}\}/g,
    /\[\s*([a-zA-Z][\w -]{1,34})\s*\]/g,
    /\{([a-zA-Z][\w -]{1,34})\}/g,
  ];

  for (const pattern of patterns) {
    for (const match of prompt.matchAll(pattern)) {
      const raw = String(match[1] ?? "").trim();
      if (!raw) continue;
      const normalized = sentenceCase(raw);
      if (!/^(input|output|json|text)$/i.test(normalized)) {
        found.add(normalized);
      }
      if (found.size >= 3) return Array.from(found);
    }
  }

  const lower = prompt.toLowerCase();
  if (/\b(topic|post|article|caption|thread|newsletter|blog)\b/.test(lower)) {
    found.add("Topic");
  }
  if (/\b(audience|customer|persona|reader|buyer)\b/.test(lower)) {
    found.add("Audience");
  }
  if (/\b(style|tone|voice|brand)\b/.test(lower)) {
    found.add("Style or tone");
  }
  if (/\b(product|offer|service|business)\b/.test(lower)) {
    found.add("Product or offer");
  }

  if (found.size === 0) {
    found.add("Source material");
  }

  return Array.from(found).slice(0, 3);
}

export function createPromptWorkflowStarter({
  prompt,
  intent = "custom",
  title,
}: PromptWorkflowStarterInput): QuickStartTemplate {
  const cleanPrompt = prompt.trim();
  const inputNames = uniqueInputNamesFromPrompt(cleanPrompt);
  const workflowTitle = title?.trim() || titleFromPrompt(cleanPrompt);
  const isImage =
    intent === "image" || /\b(image|photo|visual|art|style|thumbnail)\b/i.test(cleanPrompt);
  const inputNodes = inputNames.map((inputName, index) =>
    node(
      `input-${index + 1}`,
      "input",
      { x: 0, y: (index - Math.floor(inputNames.length / 2)) * 190 },
      {
        title: inputName,
        summary: "Collects buyer input before the workflow runs.",
        config: {
          question: `What ${inputName.toLowerCase()} should this workflow use?`,
          description:
            index === 0
              ? "This becomes the main input a buyer fills in before running the workflow."
              : "Optional context that helps the workflow produce a better result.",
          inputType: inputName.toLowerCase().includes("source") ? "textarea" : "text",
          placeholder:
            inputName === "Topic"
              ? "e.g. Launching a new AI design tool"
              : inputName === "Audience"
                ? "e.g. busy startup founders"
                : inputName === "Style or tone"
                  ? "e.g. concise, premium, playful"
                  : "Enter a value...",
          required: index === 0,
          defaultValue: "",
        },
      },
    ),
  );

  const mergeNode =
    inputNodes.length > 1
      ? node(
          "merge-1",
          "merge",
          { x: NODE_SPACING * 0.7, y: 0 },
          {
            title: "Merge inputs",
            summary: "Combines buyer inputs into one request.",
            config: {},
            type: "edgMerge",
          },
        )
      : null;

  const generatorNode = node(
    "generator-1",
    isImage ? "llm-image" : "llm-chat",
    { x: NODE_SPACING * (inputNodes.length > 1 ? 1.35 : 1), y: 0 },
    {
      title: isImage ? "Image Generator" : "AI Generator",
      summary: isImage ? "Generates a visual result." : "Generates the workflow output.",
      config: isImage
        ? {
            prompt: cleanPrompt || "Create a polished image from the buyer's input.",
            model: "gemini-3.1-flash-image-preview",
            aspectRatio: "16:9",
            quality: "medium",
            n: 1,
            timeout: 60000,
            retries: 2,
          }
        : {
            system:
              "You are running a productized Edgaze workflow. Follow the creator's instructions exactly and return a polished, useful result for the buyer.",
            prompt: cleanPrompt || "Use the buyer input to produce a helpful result.",
            model: "gpt-4o-mini",
            temperature: 0.7,
            maxTokens: 1200,
            stream: true,
            safeMode: true,
            timeout: 30000,
            retries: 2,
          },
    },
  );

  const outputNode = node(
    "output-1",
    "output",
    { x: NODE_SPACING * (inputNodes.length > 1 ? 2.05 : 2), y: 0 },
    {
      title: "Output",
      summary: "Returns the result to the buyer.",
      config: {
        name: isImage ? "Generated image" : "Generated result",
        format: isImage ? "text" : "json",
      },
    },
  );

  const edges =
    inputNodes.length > 1 && mergeNode
      ? [
          ...inputNodes.map((inputNode, index) =>
            edge(inputNode.id, "merge-1", "out-right", `in-${Math.min(index + 1, 3)}`),
          ),
          edge("merge-1", "generator-1", "out", "in"),
          edge("generator-1", "output-1", "out", "in-left"),
        ]
      : [
          edge("input-1", "generator-1", "out-right", "in"),
          edge("generator-1", "output-1", "out", "in-left"),
        ];

  return {
    id: "custom-prompt",
    title: workflowTitle,
    caption: "Generated from a pasted creator prompt.",
    graph: {
      nodes: [...inputNodes, ...(mergeNode ? [mergeNode] : []), generatorNode, outputNode],
      edges,
    },
  };
}
