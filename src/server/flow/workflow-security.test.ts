import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  workflow: null as Record<string, unknown> | null,
  purchase: null as Record<string, unknown> | null,
}));

function buildQuery(table: string) {
  return {
    select() {
      return this;
    },
    eq(column: string, value: unknown) {
      if (table === "workflows" && column === "id") {
        return this;
      }
      if (table === "workflow_purchases" && (column === "workflow_id" || column === "buyer_id")) {
        return this;
      }
      return this;
    },
    async maybeSingle() {
      if (table === "workflows") {
        return { data: mockState.workflow, error: null };
      }
      if (table === "workflow_purchases") {
        return { data: mockState.purchase, error: null };
      }
      return { data: null, error: null };
    },
  };
}

vi.mock("@lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      return buildQuery(table);
    },
  }),
}));

import {
  isAnonymousWorkflowDemoEligibleMode,
  resolveWorkflowAccessDecision,
  sanitizeWorkflowGraphForClient,
} from "./workflow-security";

describe("workflow security", () => {
  beforeEach(() => {
    mockState.workflow = {
      id: "wf_1",
      owner_id: "owner_1",
      is_public: true,
      is_published: true,
      is_paid: true,
      monetisation_mode: "paywall",
      removed_at: null,
    };
    mockState.purchase = null;
  });

  it("returns owner_edit for owners requesting edit mode", async () => {
    const result = await resolveWorkflowAccessDecision({
      workflowId: "wf_1",
      userId: "owner_1",
      requestedMode: "edit",
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("owner_edit");
    expect(result.isOwner).toBe(true);
  });

  it("returns buyer_preview for paid buyers", async () => {
    mockState.purchase = { id: "pur_1", status: "paid", refunded_at: null };

    const result = await resolveWorkflowAccessDecision({
      workflowId: "wf_1",
      userId: "buyer_1",
      requestedMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("buyer_preview");
    expect(result.isOwner).toBe(false);
  });

  it("returns anonymous_demo_allowed for anonymous paid viewers", async () => {
    const result = await resolveWorkflowAccessDecision({
      workflowId: "wf_1",
      userId: null,
      requestedMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("anonymous_demo_allowed");
  });

  it("returns free_preview for free workflows", async () => {
    mockState.workflow = {
      ...mockState.workflow,
      is_paid: false,
      monetisation_mode: "free",
    };

    const result = await resolveWorkflowAccessDecision({
      workflowId: "wf_1",
      userId: null,
      requestedMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("free_preview");
  });

  it("treats anonymous paid demos and free previews as demo-eligible", () => {
    expect(isAnonymousWorkflowDemoEligibleMode("anonymous_demo_allowed")).toBe(true);
    expect(isAnonymousWorkflowDemoEligibleMode("free_preview")).toBe(true);
    expect(isAnonymousWorkflowDemoEligibleMode("buyer_preview")).toBe(false);
  });

  it("sanitizes preview graph data", () => {
    const result = sanitizeWorkflowGraphForClient(
      {
        nodes: [
          {
            id: "node_1",
            type: "custom",
            position: { x: 10, y: 20 },
            data: {
              specId: "llm-chat",
              title: "Chat",
              config: {
                apiKey: "secret-key",
                prompt: "hidden prompt",
              },
              internalOnly: "do not leak",
            },
          },
        ],
        edges: [{ id: "edge_1", source: "node_1", target: "node_2" }],
      },
      "preview",
    );

    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: "node_1",
      type: "custom",
      position: { x: 10, y: 20 },
      data: {
        specId: "llm-chat",
        title: "Chat",
      },
    });
    expect(JSON.stringify(result.nodes[0])).not.toContain("secret-key");
    expect(JSON.stringify(result.nodes[0])).not.toContain("hidden prompt");
    expect(JSON.stringify(result.nodes[0])).not.toContain("internalOnly");
  });

  it("keeps safe input metadata for demo input collection", () => {
    const result = sanitizeWorkflowGraphForClient(
      {
        nodes: [
          {
            id: "input_1",
            type: "custom",
            position: { x: 10, y: 20 },
            data: {
              specId: "input",
              title: "Input",
              config: {
                question: "What tone should this use?",
                description: "Pick the tone that best fits your audience.",
                helpText: "This appears below the label.",
                inputType: "dropdown",
                placeholder: "Choose a tone",
                defaultValue: "friendly",
                options: [
                  "Friendly",
                  { label: "Formal", value: "formal" },
                  { label: "Casual", id: "casual" },
                ],
                apiKey: "secret-key",
                prompt: "hidden prompt",
              },
            },
          },
          {
            id: "llm_1",
            type: "custom",
            position: { x: 40, y: 80 },
            data: {
              specId: "llm-chat",
              title: "Chat",
              config: {
                prompt: "hidden prompt",
                apiKey: "secret-key",
              },
            },
          },
        ],
        edges: [],
      },
      "demo_input_collection",
    );

    expect(result.nodes[0]).toMatchObject({
      id: "input_1",
      data: {
        specId: "input",
        title: "Input",
        config: {
          question: "What tone should this use?",
          description: "Pick the tone that best fits your audience.",
          helpText: "This appears below the label.",
          inputType: "dropdown",
          placeholder: "Choose a tone",
          defaultValue: "friendly",
          options: [
            "Friendly",
            { label: "Formal", value: "formal" },
            { label: "Casual", value: "casual" },
          ],
        },
      },
    });
    expect(result.nodes[1]).toMatchObject({
      id: "llm_1",
      data: {
        specId: "llm-chat",
        title: "Chat",
      },
    });
    expect(result.nodes[1]?.data).not.toHaveProperty("config");
    expect(JSON.stringify(result.nodes[0])).not.toContain("secret-key");
    expect(JSON.stringify(result.nodes[0])).not.toContain("hidden prompt");
  });
});
