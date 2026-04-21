import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeTurnstileProof, issueTurnstileProof } from "./turnstile-proof";

const ORIGINAL_ENV = {
  turnstileProofSecret: process.env.TURNSTILE_PROOF_SECRET,
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  nextAuthSecret: process.env.NEXTAUTH_SECRET,
};

const WORKFLOW_DEMO_CONTEXT = {
  workflowId: "workflow-123",
  deviceFingerprint: "fp_mobile_ultra_premium_42",
  ipAddress: "203.0.113.5",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
};

describe("turnstile proof", () => {
  afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_ENV.turnstileProofSecret === undefined) {
      delete process.env.TURNSTILE_PROOF_SECRET;
    } else {
      process.env.TURNSTILE_PROOF_SECRET = ORIGINAL_ENV.turnstileProofSecret;
    }

    if (ORIGINAL_ENV.turnstileSecretKey === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = ORIGINAL_ENV.turnstileSecretKey;
    }

    if (ORIGINAL_ENV.nextAuthSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = ORIGINAL_ENV.nextAuthSecret;
    }
  });

  it("validates a proof multiple times before expiry for the same workflow/device context", () => {
    process.env.TURNSTILE_PROOF_SECRET = "test-turnstile-proof-secret";
    const proof = issueTurnstileProof("workflow_demo", WORKFLOW_DEMO_CONTEXT);

    expect(consumeTurnstileProof("workflow_demo", proof, WORKFLOW_DEMO_CONTEXT)).toBe(true);
    expect(consumeTurnstileProof("workflow_demo", proof, WORKFLOW_DEMO_CONTEXT)).toBe(true);
  });

  it("rejects proofs after expiry", () => {
    process.env.TURNSTILE_PROOF_SECRET = "test-turnstile-proof-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T00:00:00.000Z"));

    const proof = issueTurnstileProof("workflow_demo", WORKFLOW_DEMO_CONTEXT);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(consumeTurnstileProof("workflow_demo", proof, WORKFLOW_DEMO_CONTEXT)).toBe(false);
  });

  it("rejects a tampered proof", () => {
    process.env.TURNSTILE_PROOF_SECRET = "test-turnstile-proof-secret";
    const proof = issueTurnstileProof("workflow_demo", WORKFLOW_DEMO_CONTEXT);

    expect(consumeTurnstileProof("workflow_demo", `${proof}tampered`, WORKFLOW_DEMO_CONTEXT)).toBe(
      false,
    );
  });

  it("rejects a proof when the device fingerprint changes", () => {
    process.env.TURNSTILE_PROOF_SECRET = "test-turnstile-proof-secret";
    const proof = issueTurnstileProof("workflow_demo", WORKFLOW_DEMO_CONTEXT);

    expect(
      consumeTurnstileProof("workflow_demo", proof, {
        ...WORKFLOW_DEMO_CONTEXT,
        deviceFingerprint: "fp_other_device_99",
      }),
    ).toBe(false);
  });

  it("rejects a proof when the ip address changes", () => {
    process.env.TURNSTILE_PROOF_SECRET = "test-turnstile-proof-secret";
    const proof = issueTurnstileProof("workflow_demo", WORKFLOW_DEMO_CONTEXT);

    expect(
      consumeTurnstileProof("workflow_demo", proof, {
        ...WORKFLOW_DEMO_CONTEXT,
        ipAddress: "198.51.100.9",
      }),
    ).toBe(false);
  });
});
