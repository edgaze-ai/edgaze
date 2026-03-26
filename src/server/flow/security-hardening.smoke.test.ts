import { describe, it, expect } from "vitest";
import { loadPublishedWorkflowGraphForExecution } from "./load-workflow-graph";
import { getAuthenticatedRunEntitlement, DEMO_RUNNER_IDS } from "./marketplace-entitlement";

describe("security hardening modules", () => {
  it("exports graph loader used by /api/flow/run", () => {
    expect(typeof loadPublishedWorkflowGraphForExecution).toBe("function");
  });

  it("demo runner ids are sentinel-only", () => {
    expect(DEMO_RUNNER_IDS.has("anonymous_demo_user")).toBe(true);
    expect(DEMO_RUNNER_IDS.has("admin_demo_user")).toBe(true);
  });

  it("entitlement rejects demo runners (must use run route branches)", async () => {
    await expect(
      getAuthenticatedRunEntitlement(
        "anonymous_demo_user",
        "00000000-0000-0000-0000-000000000000",
        false,
      ),
    ).rejects.toThrow();
  });
});
