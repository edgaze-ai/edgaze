import { randomUUID } from "node:crypto";

type TurnstilePurpose = "workflow_demo";

type TurnstileProofRecord = {
  expiresAt: number;
  purpose: TurnstilePurpose;
};

const proofs = new Map<string, TurnstileProofRecord>();

const TURNSTILE_COOKIE_BY_PURPOSE: Record<TurnstilePurpose, string> = {
  workflow_demo: "edgaze_workflow_demo_captcha",
};

export function getTurnstileCookieName(purpose: TurnstilePurpose) {
  return TURNSTILE_COOKIE_BY_PURPOSE[purpose];
}

export function issueTurnstileProof(purpose: TurnstilePurpose) {
  const proof = randomUUID();
  proofs.set(proof, {
    purpose,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return proof;
}

export function consumeTurnstileProof(purpose: TurnstilePurpose, proof: string) {
  const normalizedProof = proof.trim();
  if (!normalizedProof) return false;

  const record = proofs.get(normalizedProof);
  if (!record) return false;
  if (record.purpose !== purpose) return false;
  if (record.expiresAt <= Date.now()) {
    proofs.delete(normalizedProof);
    return false;
  }

  proofs.delete(normalizedProof);
  return true;
}
