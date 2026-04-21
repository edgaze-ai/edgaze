import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserFromRequest = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockCreateWorkflowVersion = vi.hoisted(() => vi.fn());
const mockSetWorkflowActiveVersion = vi.hoisted(() => vi.fn());

vi.mock("@lib/auth/server", () => ({
  getUserFromRequest: mockGetUserFromRequest,
}));

vi.mock("@lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@lib/supabase/workflow-versions", () => ({
  createWorkflowVersion: mockCreateWorkflowVersion,
  setWorkflowActiveVersion: mockSetWorkflowActiveVersion,
}));

import { POST } from "./route";

describe("POST /api/workflows/[id]/publish-version", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUserFromRequest.mockResolvedValue({
      user: { id: "owner_1" },
      error: null,
    });
    mockCreateWorkflowVersion.mockResolvedValue({
      id: "version_1",
      version_hash: "hash_1",
    });
    mockSetWorkflowActiveVersion.mockResolvedValue(undefined);
  });

  it("returns 401 without an authenticated user", async () => {
    mockGetUserFromRequest.mockResolvedValue({
      user: null,
      error: "Missing Authorization token",
    });

    const response = await POST(
      new Request("https://www.edgaze.ai/api/workflows/wf_1/publish-version", {
        method: "POST",
        body: JSON.stringify({ graph: { nodes: [], edges: [] } }),
        headers: { "content-type": "application/json" },
      }) as any,
      { params: Promise.resolve({ id: "wf_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("rejects structurally invalid graphs before publishing", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "wf_1", owner_id: "owner_1" },
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(
      new Request("https://www.edgaze.ai/api/workflows/wf_1/publish-version", {
        method: "POST",
        body: JSON.stringify({ graph: { nodes: [], edges: [] } }),
        headers: { "content-type": "application/json" },
      }) as any,
      { params: Promise.resolve({ id: "wf_1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Workflow graph failed validation",
      details: expect.arrayContaining(["Workflow must contain at least one node"]),
    });
    expect(mockCreateWorkflowVersion).not.toHaveBeenCalled();
  });

  it("returns 403 when a different user tries to publish a workflow version", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "wf_1", owner_id: "owner_2" },
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(
      new Request("https://www.edgaze.ai/api/workflows/wf_1/publish-version", {
        method: "POST",
        body: JSON.stringify({
          graph: { nodes: [{ id: "input_1", data: { specId: "input" } }], edges: [] },
        }),
        headers: { "content-type": "application/json" },
      }) as any,
      { params: Promise.resolve({ id: "wf_1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockCreateWorkflowVersion).not.toHaveBeenCalled();
  });

  it("publishes valid graphs for the workflow owner", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "wf_1", owner_id: "owner_1" },
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(admin);

    const response = await POST(
      new Request("https://www.edgaze.ai/api/workflows/wf_1/publish-version", {
        method: "POST",
        body: JSON.stringify({
          graph: {
            nodes: [{ id: "input_1", data: { specId: "input" } }],
            edges: [],
          },
        }),
        headers: { "content-type": "application/json" },
      }) as any,
      { params: Promise.resolve({ id: "wf_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockCreateWorkflowVersion).toHaveBeenCalledWith("wf_1", {
      nodes: [{ id: "input_1", data: { specId: "input" } }],
      edges: [],
    });
    expect(mockSetWorkflowActiveVersion).toHaveBeenCalledWith("wf_1", "version_1");
  });
});
