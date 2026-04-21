import { describe, expect, it } from "vitest";

import {
  hashWorkflowDemoIpAddress,
  normalizeWorkflowDemoFingerprint,
} from "./workflow-demo-identity";

describe("workflow demo identity", () => {
  it("accepts a valid workflow demo fingerprint", () => {
    expect(normalizeWorkflowDemoFingerprint("fp_mobile_ultra_premium_42")).toBe(
      "fp_mobile_ultra_premium_42",
    );
  });

  it("rejects invalid fingerprint formats", () => {
    expect(normalizeWorkflowDemoFingerprint("")).toBeNull();
    expect(normalizeWorkflowDemoFingerprint("abc")).toBeNull();
    expect(normalizeWorkflowDemoFingerprint("fp bad value")).toBeNull();
    expect(normalizeWorkflowDemoFingerprint("fp_")).toBeNull();
  });

  it("hashes ip addresses deterministically", () => {
    const first = hashWorkflowDemoIpAddress("203.0.113.5");
    const second = hashWorkflowDemoIpAddress("203.0.113.5");

    expect(first).toBe(second);
    expect(first).not.toContain("203.0.113.5");
  });
});
