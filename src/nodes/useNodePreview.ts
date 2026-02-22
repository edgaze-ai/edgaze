// src/nodes/useNodePreview.ts
// Hook that returns the preview string per specId based on config

import { useMemo } from "react";

type NodeData = {
  specId?: string;
  config?: Record<string, unknown>;
};

export function useNodePreview(specId: string | undefined, config: Record<string, unknown> | undefined): string {
  return useMemo(() => getPreviewForSpec(specId ?? "", config ?? {}), [specId, config]);
}

export function getPreviewForSpec(specId: string, config: Record<string, unknown>): string {
  const c = config ?? {};

  switch (specId) {
    case "openai-chat": {
      const prompt = String(c.prompt ?? "").trim();
      if (!prompt) return "Not configured";
      return prompt.length > 80 ? prompt.slice(0, 80) + "…" : prompt;
    }
    case "http-request": {
      const method = String(c.method ?? "GET");
      const url = String(c.url ?? "").trim();
      if (!url) return "Not configured";
      const truncated = url.length > 40 ? url.slice(0, 40) + "…" : url;
      return `${method} ${truncated}`;
    }
    case "condition": {
      const human = String(c.humanCondition ?? "").trim();
      const op = String(c.operator ?? "truthy");
      const val = String(c.compareValue ?? "").trim();
      if (human) return `if: ${human.length > 40 ? human.slice(0, 40) + "…" : human}`;
      if (op === "truthy") return "if: is truthy";
      if (op === "falsy") return "if: is falsy";
      if (op === "equals" && val) return `if: equals "${val.slice(0, 20)}${val.length > 20 ? "…" : ""}"`;
      if (op === "notEquals" && val) return `if: not equals "${val.slice(0, 20)}${val.length > 20 ? "…" : ""}"`;
      return `if: ${op}`;
    }
    case "delay": {
      const duration = Number(c.duration ?? 1000);
      if (duration >= 60000) return `Wait ${Math.round(duration / 60000)}m`;
      if (duration >= 1000) return `Wait ${Math.round(duration / 1000)}s`;
      return `Wait ${duration}ms`;
    }
    case "input": {
      const key = String(c.name ?? "input").trim();
      return `Key: ${key || "Not configured"}`;
    }
    case "output": {
      const format = String(c.format ?? "json");
      return `Format: ${format}`;
    }
    case "merge": {
      return "Merging 3 inputs";
    }
    case "merge-json": {
      return "Merging 3 inputs";
    }
    case "loop": {
      return "Loop over: array";
    }
    case "openai-embeddings": {
      const model = String(c.model ?? "text-embedding-3-small");
      return `Model: ${model}`;
    }
    case "openai-image": {
      const size = String(c.size ?? "1024x1024");
      const n = Number(c.n ?? 1);
      return `Size: ${size} · ${n} image(s)`;
    }
    case "json-parse": {
      const path = String((c as any).path ?? "").trim();
      return path ? `Path: ${path}` : "Path: root";
    }
    case "template": {
      const t = String(c.template ?? "").trim();
      return t ? (t.length > 50 ? t.slice(0, 50) + "…" : t) : "Not configured";
    }
    case "map": {
      const t = String(c.template ?? "{{value}}").trim();
      return t.length > 50 ? t.slice(0, 50) + "…" : t;
    }
    default:
      return "Not configured";
  }
}
