import { describe, expect, it } from "vitest";

import { LEGACY_OPENAI_CHAT_CONFIG_FLAG } from "@lib/workflow/spec-id-aliases";

import { compileWorkflowDefinition, WorkflowCompileError } from "./compiler";
import { computeWorkflowOutcome } from "./outcome";
import type { WorkflowDefinition } from "./types";

function makeDefinition(input: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    workflowId: "wf_test",
    versionId: "version_test",
    builderVersion: "builder_test",
    nodes: [],
    edges: [],
    ...input,
  };
}

function getCompileError(definition: WorkflowDefinition): WorkflowCompileError {
  try {
    compileWorkflowDefinition(definition);
  } catch (error) {
    if (error instanceof WorkflowCompileError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected workflow compilation to fail.");
}

describe("compileWorkflowDefinition", () => {
  it("produces deterministic topo order independent of builder ordering", () => {
    const definition = makeDefinition({
      nodes: [
        { id: "output_a", specId: "output", config: {} },
        { id: "chat_a", specId: "llm-chat", config: { prompt: "Summarize" } },
        { id: "input_a", specId: "input", config: {} },
      ],
      edges: [
        {
          sourceNodeId: "chat_a",
          sourcePortId: "out",
          targetNodeId: "output_a",
          targetPortId: "in-left",
        },
        {
          sourceNodeId: "input_a",
          sourcePortId: "out-right",
          targetNodeId: "chat_a",
          targetPortId: "in",
        },
      ],
    });

    const compiled = compileWorkflowDefinition(definition);

    expect(compiled.topoOrder).toEqual(["input_a", "chat_a", "output_a"]);
    expect(compiled.entryNodeIds).toEqual(["input_a"]);
    expect(compiled.terminalNodeIds).toEqual(["output_a"]);
  });

  it("resolves canonical alias specs into the compiled snapshot", () => {
    const compiled = compileWorkflowDefinition(
      makeDefinition({
        nodes: [
          { id: "input_a", specId: "input", config: {} },
          { id: "chat_a", specId: "openai-chat", config: { prompt: "Hello" } },
        ],
        edges: [
          {
            sourceNodeId: "input_a",
            sourcePortId: "out-right",
            targetNodeId: "chat_a",
            targetPortId: "in",
          },
        ],
      }),
    );

    expect(compiled.nodes.map((node) => node.specId)).toEqual(["input", "llm-chat"]);
    const chatNode = compiled.nodes.find((n) => n.id === "chat_a");
    expect(chatNode?.config?.[LEGACY_OPENAI_CHAT_CONFIG_FLAG]).toBe(true);
    expect(compiled.edges[0]).toMatchObject({
      sourcePortId: "out-right",
      targetPortId: "in",
    });
  });

  it("rejects cycles", () => {
    const definition = makeDefinition({
      nodes: [
        { id: "a", specId: "json-parse", config: {} },
        { id: "b", specId: "json-parse", config: {} },
      ],
      edges: [
        { sourceNodeId: "a", sourcePortId: "output", targetNodeId: "b", targetPortId: "input" },
        { sourceNodeId: "b", sourcePortId: "output", targetNodeId: "a", targetPortId: "input" },
      ],
    });

    expect(() => compileWorkflowDefinition(definition)).toThrow(WorkflowCompileError);
    expect(() => compileWorkflowDefinition(definition)).toThrow(/cycle/i);
  });

  it("rejects incompatible explicit port bindings", () => {
    const definition = makeDefinition({
      nodes: [
        { id: "image_a", specId: "llm-image", config: { prompt: "Draw" } },
        { id: "loop_a", specId: "loop", config: {} },
      ],
      edges: [
        {
          sourceNodeId: "image_a",
          sourcePortId: "out",
          targetNodeId: "loop_a",
          targetPortId: "array",
        },
      ],
    });

    const error = getCompileError(definition);
    expect(error.details.join(" ")).toMatch(/incompatible/i);
  });

  it("requires explicit merge ports instead of implicit fan-in", () => {
    const definition = makeDefinition({
      nodes: [
        { id: "input_a", specId: "input", config: {} },
        { id: "input_b", specId: "input", config: {} },
        { id: "chat_a", specId: "llm-chat", config: { prompt: "Use inbound data" } },
      ],
      edges: [
        {
          sourceNodeId: "input_a",
          sourcePortId: "out-right",
          targetNodeId: "chat_a",
          targetPortId: "in",
        },
        {
          sourceNodeId: "input_b",
          sourcePortId: "out-right",
          targetNodeId: "chat_a",
          targetPortId: "in",
        },
      ],
    });

    const error = getCompileError(definition);
    expect(error.details.join(" ")).toMatch(/multiple inbound bindings for single port/i);
  });
});

describe("computeWorkflowOutcome", () => {
  it("returns completed_with_errors when a non-terminal node fails but a terminal node completes", () => {
    expect(
      computeWorkflowOutcome({
        runStatus: "completed",
        nodes: [
          { status: "failed", isTerminalNode: false },
          { status: "completed", isTerminalNode: true },
        ],
      }),
    ).toBe("completed_with_errors");
  });

  it("returns failed when no terminal node completed", () => {
    expect(
      computeWorkflowOutcome({
        runStatus: "failed",
        nodes: [{ status: "failed", isTerminalNode: true }],
      }),
    ).toBe("failed");
  });

  it("returns failed when all terminal nodes were skipped and no terminal output exists", () => {
    expect(
      computeWorkflowOutcome({
        runStatus: "completed",
        nodes: [
          { status: "failed", isTerminalNode: false },
          { status: "skipped", isTerminalNode: true },
        ],
      }),
    ).toBe("failed");
  });

  it("returns cancelled when the run status is cancelling", () => {
    expect(
      computeWorkflowOutcome({
        runStatus: "cancelling",
        nodes: [{ status: "running", isTerminalNode: true }],
      }),
    ).toBe("cancelled");
  });
});
