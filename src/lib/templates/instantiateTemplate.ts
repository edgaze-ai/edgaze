import { normalizeGraph } from "@/components/builder/graph-normalize";
import type {
  InstantiatedWorkflowResult,
  InstantiateTemplateInput,
  TemplateBindingTarget,
  TemplateDefinition,
  TemplateTransform,
} from "./types";
import {
  getTemplateFieldDefaults,
  validateTemplateAnswers,
  validateTemplateDefinition,
} from "./validateTemplate";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function renderPattern(pattern: string, values: Record<string, unknown>) {
  return pattern.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, token) => {
    const value = values[token];
    return value == null ? "" : String(value);
  });
}

function createStableId(base: string, index?: number) {
  const random = Math.random().toString(36).slice(2, 8);
  return index == null ? `${base}-${random}` : `${base}-${index}-${random}`;
}

function applyBinding(
  graph: { nodes: any[]; edges: any[]; meta: Record<string, unknown> },
  fieldId: string,
  binding: TemplateBindingTarget,
  value: unknown,
) {
  if (binding.target === "workflow.name") return;
  if (binding.target === "workflow.meta") {
    setByPath(graph.meta, binding.path, value);
    return;
  }

  const node = graph.nodes.find((candidate) => candidate.id === binding.nodeId);
  if (!node) return;

  if (binding.target === "node.prompt") {
    node.data = node.data ?? {};
    node.data.config = node.data.config ?? {};
    const existing = node.data.config.prompt;
    node.data.config.prompt =
      typeof existing === "string" && existing.includes("{{")
        ? renderPattern(existing, { [fieldId]: value })
        : value;
    return;
  }

  node.data = node.data ?? {};
  node.data.config = node.data.config ?? {};
  const currentValue = binding.path
    .split(".")
    .filter(Boolean)
    .reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), node.data.config);

  const nextValue =
    typeof currentValue === "string" && currentValue.includes("{{")
      ? renderPattern(currentValue, { [fieldId]: value })
      : value;
  setByPath(node.data.config, binding.path, nextValue);
}

function removeNode(graph: { nodes: any[]; edges: any[] }, nodeId: string) {
  graph.nodes = graph.nodes.filter((node) => node.id !== nodeId);
  graph.edges = graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
}

function removeManagedAiArtCreatorEdges(
  graph: { nodes: any[]; edges: any[] },
  managedNodeIds: Set<string>,
) {
  graph.edges = graph.edges.filter(
    (edge) => !managedNodeIds.has(edge.source) && !managedNodeIds.has(edge.target),
  );
}

function configureInputNode(node: any, index: number, answers: Record<string, unknown>) {
  node.data = node.data ?? {};
  node.data.title = `Input ${index}`;
  node.data.config = node.data.config ?? {};
  node.data.config.question = answers[`inputQuestion${index}`] ?? "";
  node.data.config.inputType = answers[`inputType${index}`] ?? "text";
  if (node.data.config.inputType === "dropdown") {
    const rawOptions = answers[`inputOptions${index}`];
    node.data.config.options = Array.isArray(rawOptions)
      ? rawOptions.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } else {
    node.data.config.options = [];
  }
  if (!node.data.config.description) {
    node.data.config.description = "";
  }
}

function applyAiArtCreatorInputsTransform(
  graph: { nodes: any[]; edges: any[]; meta: Record<string, unknown> },
  transform: Extract<TemplateTransform, { type: "ai_art_creator_inputs" }>,
  answers: Record<string, unknown>,
  warnings: string[],
) {
  const sourceNode = graph.nodes.find((candidate) => candidate.id === transform.inputNodeId);
  const primaryMerge = graph.nodes.find(
    (candidate) => candidate.id === transform.primaryMergeNodeId,
  );
  const secondaryMerge = graph.nodes.find(
    (candidate) => candidate.id === transform.secondaryMergeNodeId,
  );
  const promptNode = graph.nodes.find((candidate) => candidate.id === transform.promptNodeId);
  const imageNode = graph.nodes.find((candidate) => candidate.id === transform.imageNodeId);
  const outputNode = graph.nodes.find((candidate) => candidate.id === transform.outputNodeId);

  if (!sourceNode || !primaryMerge || !secondaryMerge || !promptNode || !imageNode || !outputNode) {
    warnings.push("AI Art Creator transform is missing one or more blueprint nodes.");
    return;
  }

  const requestedCount = Number(answers[transform.countFromField] ?? 3);
  const count = Number.isFinite(requestedCount) ? Math.max(1, Math.floor(requestedCount)) : 3;
  const finalCount = Math.min(count, transform.maxInputs);

  if (count > transform.maxInputs) {
    warnings.push(`Requested ${count} inputs; capped at ${transform.maxInputs}.`);
  }

  const managedNodeIds = new Set<string>([
    transform.inputNodeId,
    transform.primaryMergeNodeId,
    transform.secondaryMergeNodeId,
  ]);
  for (const node of graph.nodes) {
    if (typeof node.id === "string" && node.id.startsWith(`${transform.inputNodeId}-`)) {
      managedNodeIds.add(node.id);
    }
  }

  graph.nodes = graph.nodes.filter(
    (node) =>
      !managedNodeIds.has(node.id) ||
      node.id === transform.inputNodeId ||
      node.id === transform.primaryMergeNodeId ||
      node.id === transform.secondaryMergeNodeId,
  );
  removeManagedAiArtCreatorEdges(graph, managedNodeIds);

  primaryMerge.position = { x: 300, y: -40 };
  secondaryMerge.position = { x: 640, y: 140 };

  if (finalCount <= 3) {
    removeNode(graph, transform.secondaryMergeNodeId);
    promptNode.position = { x: 620, y: -40 };
    imageNode.position = { x: 940, y: -40 };
    outputNode.position = { x: 1260, y: -40 };
  } else {
    if (!graph.nodes.some((node) => node.id === transform.secondaryMergeNodeId)) {
      graph.nodes.push(secondaryMerge);
    }
    promptNode.position = { x: 980, y: 40 };
    imageNode.position = { x: 1300, y: 40 };
    outputNode.position = { x: 1620, y: 40 };
  }

  const inputPositions = [
    { x: 0, y: -220 },
    { x: 0, y: -40 },
    { x: 0, y: 140 },
    { x: 340, y: 50 },
    { x: 340, y: 230 },
  ];

  sourceNode.position = inputPositions[0]!;
  configureInputNode(sourceNode, 1, answers);
  graph.edges.push({
    id: createStableId(`e-${sourceNode.id}-${transform.primaryMergeNodeId}`),
    source: sourceNode.id,
    target: transform.primaryMergeNodeId,
    sourceHandle: "out-right",
    targetHandle: "in-1",
    type: "default",
  });

  for (let index = 2; index <= finalCount; index += 1) {
    const clone = deepClone(sourceNode);
    clone.id = createStableId(transform.inputNodeId, index);
    clone.position = inputPositions[index - 1]!;
    configureInputNode(clone, index, answers);
    graph.nodes.push(clone);

    const targetNodeId = index <= 3 ? transform.primaryMergeNodeId : transform.secondaryMergeNodeId;
    const targetHandle = index <= 3 ? `in-${index}` : `in-${index - 2}`;
    graph.edges.push({
      id: createStableId(`e-${clone.id}-${targetNodeId}`),
      source: clone.id,
      target: targetNodeId,
      sourceHandle: "out-right",
      targetHandle,
      type: "default",
    });
  }

  if (finalCount <= 3) {
    graph.edges.push({
      id: createStableId(`e-${transform.primaryMergeNodeId}-${transform.promptNodeId}`),
      source: transform.primaryMergeNodeId,
      target: transform.promptNodeId,
      sourceHandle: "out",
      targetHandle: "in",
      type: "default",
    });
    return;
  }

  graph.edges.push({
    id: createStableId(`e-${transform.primaryMergeNodeId}-${transform.secondaryMergeNodeId}`),
    source: transform.primaryMergeNodeId,
    target: transform.secondaryMergeNodeId,
    sourceHandle: "out",
    targetHandle: "in-1",
    type: "default",
  });
  graph.edges.push({
    id: createStableId(`e-${transform.secondaryMergeNodeId}-${transform.promptNodeId}`),
    source: transform.secondaryMergeNodeId,
    target: transform.promptNodeId,
    sourceHandle: "out",
    targetHandle: "in",
    type: "default",
  });
}

function applyTransform(
  graph: { nodes: any[]; edges: any[]; meta: Record<string, unknown> },
  transform: TemplateTransform,
  answers: Record<string, unknown>,
  warnings: string[],
) {
  switch (transform.type) {
    case "set_node_config": {
      const node = graph.nodes.find((candidate) => candidate.id === transform.nodeId);
      if (!node) {
        warnings.push(`Missing node ${transform.nodeId} for config transform.`);
        return;
      }
      node.data = node.data ?? {};
      node.data.config = node.data.config ?? {};
      setByPath(node.data.config, transform.path, answers[transform.valueFromField]);
      return;
    }
    case "set_node_prompt": {
      const node = graph.nodes.find((candidate) => candidate.id === transform.nodeId);
      if (!node) {
        warnings.push(`Missing node ${transform.nodeId} for prompt transform.`);
        return;
      }
      node.data = node.data ?? {};
      node.data.config = node.data.config ?? {};
      node.data.config.prompt = answers[transform.valueFromField];
      return;
    }
    case "conditional_node": {
      const answer = answers[transform.whenField];
      const isMatch = answer === transform.equals;
      const shouldKeep =
        (transform.action === "include" && isMatch) || (transform.action === "exclude" && !isMatch);
      if (!shouldKeep) removeNode(graph, transform.nodeId);
      return;
    }
    case "ai_art_creator_inputs": {
      applyAiArtCreatorInputsTransform(graph, transform, answers, warnings);
      return;
    }
    case "repeat_node": {
      const sourceNode = graph.nodes.find((candidate) => candidate.id === transform.sourceNodeId);
      if (!sourceNode) {
        warnings.push(`Missing node ${transform.sourceNodeId} for repeat transform.`);
        return;
      }

      const requestedCount = Number(answers[transform.countFromField] ?? 1);
      const count = Number.isFinite(requestedCount) ? Math.max(1, Math.floor(requestedCount)) : 1;
      if (typeof transform.maxClones === "number" && count > transform.maxClones) {
        warnings.push(
          `Requested ${count} nodes for ${transform.sourceNodeId}; capped at ${transform.maxClones}.`,
        );
      }
      const finalCount =
        typeof transform.maxClones === "number" ? Math.min(count, transform.maxClones) : count;

      sourceNode.data = sourceNode.data ?? {};
      sourceNode.data.title =
        transform.rename?.pattern != null
          ? renderPattern(transform.rename.pattern, { index: 1 })
          : sourceNode.data.title;
      if (transform.configLabelPath) {
        sourceNode.data.config = sourceNode.data.config ?? {};
        setByPath(
          sourceNode.data.config,
          transform.configLabelPath,
          renderPattern("Input {{index}}", { index: 1 }),
        );
      }

      for (let index = 2; index <= finalCount; index += 1) {
        const clone = deepClone(sourceNode);
        clone.id = createStableId(transform.sourceNodeId, index);
        if (transform.placement === "horizontal") {
          clone.position.x = Number(sourceNode.position?.x ?? 0) + (index - 1) * transform.gap;
        } else {
          clone.position.y = Number(sourceNode.position?.y ?? 0) + (index - 1) * transform.gap;
        }
        clone.selected = false;
        clone.data = clone.data ?? {};
        if (transform.rename?.pattern) {
          clone.data.title = renderPattern(transform.rename.pattern, { index });
        }
        if (transform.configLabelPath) {
          clone.data.config = clone.data.config ?? {};
          setByPath(
            clone.data.config,
            transform.configLabelPath,
            renderPattern("Input {{index}}", { index }),
          );
        }
        graph.nodes.push(clone);

        if (transform.edgeTarget) {
          graph.edges.push({
            id: createStableId(`e-${clone.id}-${transform.edgeTarget.nodeId}`),
            source: clone.id,
            target: transform.edgeTarget.nodeId,
            sourceHandle: "out-right",
            targetHandle:
              transform.edgeTarget.handle ??
              (transform.edgeTarget.handlePattern
                ? renderPattern(transform.edgeTarget.handlePattern, { index })
                : undefined),
            type: "default",
          });
        }
      }
      return;
    }
    default:
      return;
  }
}

function resolveWorkflowName(template: TemplateDefinition, answers: Record<string, unknown>) {
  const primaryOutcome = template.meta.outcomes?.[0];
  const count = answers.inputCount != null ? Number(answers.inputCount) : null;
  if (primaryOutcome && count && Number.isFinite(count)) {
    return `${template.meta.name} (${count} input${count === 1 ? "" : "s"})`;
  }
  return template.meta.name;
}

export async function instantiateTemplate(
  input: InstantiateTemplateInput,
): Promise<InstantiatedWorkflowResult> {
  const templateErrors = validateTemplateDefinition(input.template);
  if (templateErrors.length > 0) {
    throw new Error(templateErrors.join(" "));
  }

  const answers = {
    ...getTemplateFieldDefaults(input.template.setup.fields),
    ...input.answers,
  };

  const answerErrors = validateTemplateAnswers(input.template, answers);
  if (answerErrors.length > 0) {
    throw new Error(answerErrors.join(" "));
  }

  const graph = deepClone({
    nodes: input.template.blueprint.nodes,
    edges: input.template.blueprint.edges,
    meta: {},
  });
  const warnings: string[] = [];

  for (const binding of input.template.instantiation.variableBindings) {
    applyBinding(graph, binding.fieldId, binding.target, answers[binding.fieldId]);
  }

  for (const transform of input.template.instantiation.transforms) {
    applyTransform(graph, transform, answers, warnings);
  }

  const normalized = normalizeGraph(graph);
  const workflowName = resolveWorkflowName(input.template, answers);

  return {
    workflowName,
    graph: {
      ...normalized,
      meta: {
        ...graph.meta,
        sourceTemplateId: input.template.id,
        sourceTemplateSlug: input.template.slug,
        sourceTemplateVersion: input.template.version,
        sourceEntrypoint: input.context.mode,
        setupAnswers: answers,
        createdAt: nowIso(),
      },
      viewport: input.template.blueprint.defaultViewport,
    },
    audit: {
      templateId: input.template.id,
      templateVersion: input.template.version,
      appliedAnswers: answers,
      warnings,
    },
  };
}
