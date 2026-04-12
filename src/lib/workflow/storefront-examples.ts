import type { WorkflowInput } from "./run-types";

function normalizeSeedValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function buildTextareaExample(input: WorkflowInput, index: number): string {
  const label = input.name?.trim() || `Input ${index + 1}`;
  const placeholder = input.placeholder?.trim();

  if (placeholder) {
    return placeholder;
  }

  return `Example ${label.toLowerCase()}: give the workflow enough context to produce a strong first result.`;
}

function buildJsonExample(input: WorkflowInput, index: number): string {
  const label = input.name?.trim() || `Input ${index + 1}`;
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return JSON.stringify(
    {
      [key || `input_${index + 1}`]: input.placeholder || input.description || "Example value",
      priority: "high",
    },
    null,
    2,
  );
}

function buildTextExample(input: WorkflowInput, index: number): string {
  if (input.placeholder?.trim()) return input.placeholder.trim();
  if (input.description?.trim()) return input.description.trim();

  const label = input.name?.trim() || `Input ${index + 1}`;
  return `Example ${label.toLowerCase()}`;
}

export function buildWorkflowStorefrontExampleInputs(
  inputs: WorkflowInput[],
  seededValues?: Record<string, unknown> | null,
): Record<string, string | null> {
  const next: Record<string, string | null> = {};

  inputs.forEach((input, index) => {
    const seeded = normalizeSeedValue(seededValues?.[input.nodeId]);
    if (seeded) {
      next[input.nodeId] = seeded;
      return;
    }

    if (input.defaultValue?.trim()) {
      next[input.nodeId] = input.defaultValue.trim();
      return;
    }

    if (input.type === "dropdown") {
      next[input.nodeId] = input.options?.[0]?.value ?? null;
      return;
    }

    if (input.type === "file") {
      next[input.nodeId] = null;
      return;
    }

    if (input.type === "number") {
      next[input.nodeId] = "3";
      return;
    }

    if (input.type === "json") {
      next[input.nodeId] = buildJsonExample(input, index);
      return;
    }

    if (input.type === "textarea") {
      next[input.nodeId] = buildTextareaExample(input, index);
      return;
    }

    if (input.type === "url") {
      next[input.nodeId] = "https://example.com";
      return;
    }

    next[input.nodeId] = buildTextExample(input, index);
  });

  return next;
}
