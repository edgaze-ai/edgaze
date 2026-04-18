"use client";

import type { Edge, Node } from "reactflow";
import TemplateGraphPreview from "@/components/templates/TemplateGraphPreview";
import type { TemplatePreviewGraph } from "@/lib/templates";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";
import { getNodeSpec } from "@/nodes/registry";

function createNode(
  id: string,
  specId: string,
  position: { x: number; y: number },
  config: Record<string, unknown> = {},
  title?: string,
  summary?: string,
): Node {
  const spec = getNodeSpec(specId);

  return {
    id,
    type: spec?.nodeType ?? "edgCard",
    position,
    data: {
      specId,
      title: title ?? spec?.label ?? specId,
      version: spec?.version ?? "1.0.0",
      summary: summary ?? spec?.summary ?? "",
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

const DOC_GRAPH_REGISTRY: Record<string, { title: string; graph: TemplatePreviewGraph }> = {
  "workflow-input": {
    title: "Workflow Input",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 60, y: 70 },
          { question: "What should the workflow receive?", inputType: "text" },
          "Workflow Input",
          "Collects the first answer from the customer.",
        ),
      ],
      edges: [],
    },
  },
  merge: {
    title: "Merge",
    graph: {
      nodes: [
        createNode("input-1", "input", { x: 0, y: -80 }, { question: "Input 1" }, "Input 1"),
        createNode("input-2", "input", { x: 0, y: 70 }, { question: "Input 2" }, "Input 2"),
        createNode(
          "merge",
          "merge",
          { x: 320, y: -10 },
          {},
          "Merge",
          "Combines several inputs into one downstream payload.",
        ),
        createNode("out", "output", { x: 620, y: -10 }, { name: "Merged result" }, "Output"),
      ],
      edges: [
        createEdge("e1", "input-1", "merge", "out-right", "in-1"),
        createEdge("e2", "input-2", "merge", "out-right", "in-2"),
        createEdge("e3", "merge", "out", "out", "in-left"),
      ],
    },
  },
  "workflow-output": {
    title: "Workflow Output",
    graph: {
      nodes: [
        createNode("chat", "llm-chat", { x: 0, y: 0 }, {}, "LLM Chat", "Produces the response."),
        createNode(
          "out",
          "output",
          { x: 340, y: 0 },
          { name: "Final answer", format: "text" },
          "Workflow Output",
          "Returns the final result to the user.",
        ),
      ],
      edges: [createEdge("e1", "chat", "out", "out", "in-left")],
    },
  },
  "llm-chat": {
    title: "LLM Chat",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 0 },
          { question: "What should the model work on?" },
          "Input",
        ),
        createNode(
          "chat",
          "llm-chat",
          { x: 320, y: 0 },
          { model: "claude-sonnet-4-5" },
          "LLM Chat",
          "Reasoning, rewriting, extraction, and text generation.",
        ),
        createNode("out", "output", { x: 650, y: 0 }, { name: "Model response" }, "Output"),
      ],
      edges: [
        createEdge("e1", "input", "chat", "out-right", "in"),
        createEdge("e2", "chat", "out", "out", "in-left"),
      ],
    },
  },
  "llm-image": {
    title: "LLM Image",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 0 },
          { question: "What image should be generated?" },
          "Prompt",
        ),
        createNode(
          "image",
          "llm-image",
          { x: 330, y: 0 },
          { aspectRatio: "16:9" },
          "LLM Image",
          "Generates the final image from a prompt.",
        ),
        createNode("out", "output", { x: 660, y: 0 }, { name: "Image result" }, "Output"),
      ],
      edges: [
        createEdge("e1", "input", "image", "out-right", "in"),
        createEdge("e2", "image", "out", "out", "in-left"),
      ],
    },
  },
  "llm-embeddings": {
    title: "LLM Embeddings",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 0 },
          { question: "Which text should be embedded?" },
          "Input",
        ),
        createNode(
          "embed",
          "llm-embeddings",
          { x: 330, y: 0 },
          { model: "text-embedding-3-small" },
          "LLM Embeddings",
          "Turns text into a vector representation.",
        ),
      ],
      edges: [createEdge("e1", "input", "embed", "out-right", "in")],
    },
  },
  condition: {
    title: "Condition",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 70 },
          { question: "Should the workflow continue?" },
          "Input",
        ),
        createNode(
          "condition",
          "condition",
          { x: 330, y: 25 },
          { operator: "truthy", humanCondition: "The answer clearly says yes" },
          "Condition",
          "Sends execution down the true or false branch.",
        ),
        createNode("true-out", "output", { x: 700, y: -70 }, { name: "True branch" }, "True"),
        createNode("false-out", "output", { x: 700, y: 140 }, { name: "False branch" }, "False"),
      ],
      edges: [
        createEdge("e1", "input", "condition", "out-right", "input"),
        createEdge("e2", "condition", "true-out", "true", "in-left"),
        createEdge("e3", "condition", "false-out", "false", "in-left"),
      ],
    },
  },
  loop: {
    title: "Loop",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 60 },
          { question: "Provide a list of items", inputType: "json" },
          "Array Input",
        ),
        createNode(
          "loop",
          "loop",
          { x: 330, y: 50 },
          { maxIterations: 100 },
          "Loop",
          "Emits the current item and current index for each array entry.",
        ),
        createNode("item-out", "output", { x: 680, y: -30 }, { name: "Item output" }, "Item"),
        createNode("index-out", "output", { x: 680, y: 140 }, { name: "Index output" }, "Index"),
      ],
      edges: [
        createEdge("e1", "input", "loop", "out-right", "array"),
        createEdge("e2", "loop", "item-out", "item", "in-left"),
        createEdge("e3", "loop", "index-out", "index", "in-left"),
      ],
    },
  },
  delay: {
    title: "Delay",
    graph: {
      nodes: [
        createNode("input", "input", { x: 0, y: 0 }, { question: "Start value" }, "Input"),
        createNode(
          "delay",
          "delay",
          { x: 330, y: 0 },
          { duration: 3000 },
          "Delay",
          "Pauses execution before passing data forward.",
        ),
        createNode("out", "output", { x: 650, y: 0 }, { name: "Delayed result" }, "Output"),
      ],
      edges: [
        createEdge("e1", "input", "delay", "out-right", "input"),
        createEdge("e2", "delay", "out", "output", "in-left"),
      ],
    },
  },
  "http-request": {
    title: "HTTP Request",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 0 },
          { question: "Which endpoint or payload should be sent?" },
          "Input",
        ),
        createNode(
          "http",
          "http-request",
          { x: 330, y: 0 },
          { method: "GET", url: "https://api.example.com/data" },
          "HTTP Request",
          "Fetches or sends data to an external endpoint.",
        ),
        createNode("out", "output", { x: 680, y: 0 }, { name: "Response payload" }, "Output"),
      ],
      edges: [
        createEdge("e1", "input", "http", "out-right", "in"),
        createEdge("e2", "http", "out", "out", "in-left"),
      ],
    },
  },
  "json-parse": {
    title: "JSON Parse",
    graph: {
      nodes: [
        createNode(
          "input",
          "input",
          { x: 0, y: 0 },
          { question: "Paste a JSON string", inputType: "textarea" },
          "JSON String",
        ),
        createNode(
          "parse",
          "json-parse",
          { x: 330, y: 0 },
          {},
          "JSON Parse",
          "Converts a JSON string into a structured object.",
        ),
        createNode(
          "out",
          "output",
          { x: 680, y: 0 },
          { name: "Parsed object", format: "json" },
          "Output",
        ),
      ],
      edges: [
        createEdge("e1", "input", "parse", "out-right", "input"),
        createEdge("e2", "parse", "out", "output", "in-left"),
      ],
    },
  },
};

export default function DocsWorkflowEmbed({ slug }: { slug: string }) {
  const template = TEMPLATE_REGISTRY.find((item) => item.slug === slug);
  const docGraph = DOC_GRAPH_REGISTRY[slug];

  const title = template?.meta.name ?? docGraph?.title ?? "Workflow Preview";
  const graph = template?.preview.graphLayout ?? docGraph?.graph;

  if (!graph) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
        Workflow preview unavailable.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Workflow Preview</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-white/95">{title}</h3>
        </div>
        <p className="hidden text-[12px] text-white/45 sm:block">Read-only builder graph</p>
      </div>
      <TemplateGraphPreview
        graph={graph}
        className="h-[220px] sm:h-[300px] lg:h-[340px]"
        fitViewPadding={0.24}
      />
    </div>
  );
}
