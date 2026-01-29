// src/lib/workflow/input-extraction.ts
/**
 * Extract input requirements from workflow graph
 */

import type { WorkflowInput } from "../../components/builder/PremiumWorkflowRunModal";

export type GraphNode = {
  id: string;
  data?: {
    specId?: string;
    config?: any;
    title?: string;
  };
};

export function extractWorkflowInputs(nodes: GraphNode[]): WorkflowInput[] {
  const inputs: WorkflowInput[] = [];
  
  for (const node of nodes) {
    const specId = node.data?.specId;
    if (specId !== "input") continue;
    
    const config = node.data?.config || {};
    const title = node.data?.title || config.name || config.nickname || "Input";
    const question = config.question || title; // Use question if available, fallback to title
    
    // Determine input type from config
    let inputType: WorkflowInput["type"] = "text";
    if (config.inputType) {
      const typeMap: Record<string, WorkflowInput["type"]> = {
        text: "text",
        number: "number",
        textarea: "textarea",
        url: "url",
        file: "file",
        json: "json",
      };
      inputType = typeMap[config.inputType] || "text";
    }
    
    inputs.push({
      nodeId: node.id,
      specId: specId,
      name: question, // Use question as the display name
      description: config.description || config.helpText || undefined,
      type: inputType,
      required: config.required !== false, // default to true
      placeholder: config.placeholder || undefined,
      defaultValue: config.defaultValue || undefined,
    });
  }
  
  return inputs;
}

/**
 * Extract output nodes from workflow graph
 */
export function extractWorkflowOutputs(nodes: GraphNode[]): Array<{ nodeId: string; label: string }> {
  const outputs: Array<{ nodeId: string; label: string }> = [];
  
  for (const node of nodes) {
    const specId = node.data?.specId;
    if (specId !== "output") continue;
    
    const config = node.data?.config || {};
    const title = node.data?.title || config.name || config.label || "Output";
    
    outputs.push({
      nodeId: node.id,
      label: title,
    });
  }
  
  return outputs;
}
