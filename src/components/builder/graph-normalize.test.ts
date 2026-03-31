import { describe, expect, it } from "vitest";

import { QUICK_START_TEMPLATES } from "@lib/quickStartTemplates";
import { normalizeGraph } from "./graph-normalize";

describe("normalizeGraph", () => {
  it("migrates legacy node types and handle ids for old workflows", () => {
    const graph = {
      nodes: [
        { id: 1, type: "edgCard", position: { x: 0, y: 0 }, data: { specId: "input" } },
        { id: "merge-1", type: "edgCard", position: { x: 300, y: 0 }, data: { specId: "merge" } },
        { id: "out-1", type: "edgCard", position: { x: 600, y: 0 }, data: { specId: "output" } },
      ],
      edges: [
        { source: 1, target: "merge-1", sourceHandle: "data", targetHandle: "in-top" },
        { source: "merge-1", target: "out-1", sourceHandle: "out-right", targetHandle: "data" },
      ],
    };

    const normalized = normalizeGraph(graph);

    expect(normalized.nodes.map((n) => ({ id: n.id, type: n.type }))).toEqual([
      { id: "1", type: "edgCard" },
      { id: "merge-1", type: "edgMerge" },
      { id: "out-1", type: "edgCard" },
    ]);

    expect(normalized.edges).toMatchObject([
      {
        source: "1",
        target: "merge-1",
        sourceHandle: "out-right",
        targetHandle: "in-2",
      },
      {
        source: "merge-1",
        target: "out-1",
        sourceHandle: "out",
        targetHandle: "in-left",
      },
    ]);
  });

  it("migrates claude-chat and gemini-chat nodes to llm-chat", () => {
    const graph = {
      nodes: [
        {
          id: "c1",
          type: "edgCard",
          position: { x: 0, y: 0 },
          data: { specId: "claude-chat", config: { model: "claude-sonnet-4-6" } },
        },
        {
          id: "g1",
          type: "edgCard",
          position: { x: 200, y: 0 },
          data: { specId: "gemini-chat", config: { model: "gemini-2.5-flash" } },
        },
      ],
      edges: [],
    };
    const normalized = normalizeGraph(graph);
    const n0 = normalized.nodes[0];
    const n1 = normalized.nodes[1];
    expect(n0).toBeDefined();
    expect(n1).toBeDefined();
    expect(n0!.data?.specId).toBe("llm-chat");
    expect(n1!.data?.specId).toBe("llm-chat");
    expect((n0!.data as { config?: { model?: string } })?.config?.model).toBe("claude-sonnet-4-6");
  });

  it("keeps modern graphs unchanged", () => {
    const graph = {
      nodes: [
        { id: "input-1", type: "edgCard", position: { x: 0, y: 0 }, data: { specId: "input" } },
        { id: "chat-1", type: "edgCard", position: { x: 300, y: 0 }, data: { specId: "llm-chat" } },
        { id: "output-1", type: "edgCard", position: { x: 600, y: 0 }, data: { specId: "output" } },
      ],
      edges: [
        {
          id: "e-input-chat",
          source: "input-1",
          target: "chat-1",
          sourceHandle: "out-right",
          targetHandle: "in",
        },
        {
          id: "e-chat-output",
          source: "chat-1",
          target: "output-1",
          sourceHandle: "out",
          targetHandle: "in-left",
        },
      ],
    };

    const normalized = normalizeGraph(graph);

    expect(normalized.nodes).toEqual(graph.nodes);
    expect(normalized.edges).toEqual(graph.edges);
  });

  it("migrates legacy quick-start template handles so edges remain renderable", () => {
    const template = QUICK_START_TEMPLATES[0];
    const normalized = normalizeGraph(template?.graph);

    expect(normalized.edges).toMatchObject([
      { sourceHandle: "out-right", targetHandle: "in" },
      { sourceHandle: "out", targetHandle: "in-left" },
    ]);
  });
});
