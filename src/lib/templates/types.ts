import type { Edge, Node } from "reactflow";

export type TemplateCategory =
  | "image"
  | "video"
  | "text"
  | "research"
  | "leadgen"
  | "social"
  | "utility";

export type TemplateStatus = "draft" | "published" | "archived";
export type TemplateSetupMode = "none" | "simple" | "guided";

export type TemplatePreviewSample = {
  type: "image" | "text" | "json";
  value: string;
};

export type TemplatePreviewGraph = {
  nodes: Node[];
  edges: Edge[];
};

export type TemplateSetupField = {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "radio" | "switch" | "json" | "list";
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string; hint?: string }>;
  min?: number;
  max?: number;
  step?: number;
  ui?: {
    section?: string;
    advanced?: boolean;
    width?: "full" | "half";
    visibleWhen?: {
      fieldId: string;
      equals?: unknown;
      gte?: number;
      lte?: number;
    };
  };
  validation?: {
    kind: "string" | "number" | "enum" | "custom";
    message?: string;
  };
};

export type BlueprintGraph = {
  nodes: Node[];
  edges: Edge[];
  entryStrategy: "new_workflow" | "insert_into_current";
  defaultViewport?: { x: number; y: number; zoom: number };
};

export type TemplateBindingTarget =
  | { target: "workflow.name" }
  | { target: "workflow.meta"; path: string }
  | { target: "node.config"; nodeId: string; path: string }
  | { target: "node.prompt"; nodeId: string };

export type VariableBinding = {
  fieldId: string;
  target: TemplateBindingTarget;
};

export type TemplateTransform =
  | {
      type: "repeat_node";
      sourceNodeId: string;
      countFromField: string;
      placement: "horizontal" | "vertical";
      gap: number;
      maxClones?: number;
      edgeTarget?: { nodeId: string; handlePattern?: string; handle?: string };
      rename?: { pattern: string };
      configLabelPath?: string;
    }
  | {
      type: "set_node_config";
      nodeId: string;
      path: string;
      valueFromField: string;
    }
  | {
      type: "set_node_prompt";
      nodeId: string;
      valueFromField: string;
    }
  | {
      type: "conditional_node";
      whenField: string;
      equals: unknown;
      action: "include" | "exclude";
      nodeId: string;
    }
  | {
      type: "ai_art_creator_inputs";
      countFromField: string;
      inputNodeId: string;
      primaryMergeNodeId: string;
      secondaryMergeNodeId: string;
      promptNodeId: string;
      imageNodeId: string;
      outputNodeId: string;
      maxInputs: number;
    };

export type TemplateValidator = {
  fieldId: string;
  kind: "required" | "min" | "max" | "enum";
  value?: number | string | string[];
  message: string;
};

export type TemplateDefinition = {
  id: string;
  slug: string;
  version: number;
  status: TemplateStatus;
  meta: {
    name: string;
    shortDescription: string;
    longDescription: string;
    category: TemplateCategory;
    tags: string[];
    featured?: boolean;
    icon?: string;
    coverImage?: string;
    estimatedSetupMinutes?: number;
    difficulty?: "beginner" | "intermediate" | "advanced";
    outcomes?: string[];
  };
  preview: {
    heroMode?: "graph" | "image" | "split";
    sampleOutputs?: TemplatePreviewSample[];
    graphLayout: TemplatePreviewGraph;
  };
  setup: {
    mode: TemplateSetupMode;
    fields: TemplateSetupField[];
    submitLabel?: string;
  };
  blueprint: BlueprintGraph;
  instantiation: {
    variableBindings: VariableBinding[];
    validators: TemplateValidator[];
    transforms: TemplateTransform[];
  };
};

export type InstantiateTemplateInput = {
  template: TemplateDefinition;
  answers: Record<string, unknown>;
  context: {
    mode: "builder_modal" | "template_page";
    targetWorkflowId?: string;
  };
};

export type InstantiatedWorkflowResult = {
  workflowName: string;
  graph: {
    nodes: Node[];
    edges: Edge[];
    meta: {
      sourceTemplateId: string;
      sourceTemplateSlug: string;
      sourceTemplateVersion: number;
      sourceEntrypoint: "builder_modal" | "template_page";
      setupAnswers: Record<string, unknown>;
      createdAt: string;
    };
    viewport?: { x: number; y: number; zoom: number };
  };
  audit: {
    templateId: string;
    templateVersion: number;
    appliedAnswers: Record<string, unknown>;
    warnings: string[];
  };
};

export type TemplateFilters = {
  category?: TemplateCategory | "all";
  featuredOnly?: boolean;
  query?: string;
};
