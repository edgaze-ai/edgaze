import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type TurnstilePurpose = "workflow_demo";

type WorkflowDemoProofContext = {
  workflowId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
};

type TurnstileProofContextByPurpose = {
  workflow_demo: WorkflowDemoProofContext;
};

const TURNSTILE_COOKIE_BY_PURPOSE: Record<TurnstilePurpose, string> = {
  workflow_demo: "edgaze_workflow_demo_captcha",
};

const TURNSTILE_PROOF_TTL_MS = 10 * 60 * 1000;

export function getTurnstileCookieName(purpose: TurnstilePurpose) {
  return TURNSTILE_COOKIE_BY_PURPOSE[purpose];
}

function getTurnstileProofSecret() {
  return (
    process.env.TURNSTILE_PROOF_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

function signTurnstileProof(payload: string) {
  const secret = getTurnstileProofSecret();
  if (!secret) {
    throw new Error(
      "Missing Turnstile proof secret. Set TURNSTILE_PROOF_SECRET, TURNSTILE_SECRET_KEY, or NEXTAUTH_SECRET.",
    );
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hashProofValue(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function serializeWorkflowDemoContext(context: WorkflowDemoProofContext) {
  return [
    context.workflowId.trim(),
    context.deviceFingerprint.trim(),
    context.ipAddress.trim(),
    hashProofValue(context.userAgent.trim()),
  ].join(":");
}

function serializeProofContext(
  purpose: TurnstilePurpose,
  context: TurnstileProofContextByPurpose[TurnstilePurpose],
) {
  return serializeWorkflowDemoContext(context);
}

export function issueTurnstileProof<Purpose extends TurnstilePurpose>(
  purpose: Purpose,
  context: TurnstileProofContextByPurpose[Purpose],
) {
  const expiresAt = Date.now() + TURNSTILE_PROOF_TTL_MS;
  const nonce = randomUUID();
  const serializedContext = serializeProofContext(purpose, context);
  const payload = `${purpose}:${expiresAt}:${nonce}:${serializedContext}`;
  const signature = signTurnstileProof(payload);
  return `${payload}.${signature}`;
}

export function consumeTurnstileProof<Purpose extends TurnstilePurpose>(
  purpose: Purpose,
  proof: string,
  context: TurnstileProofContextByPurpose[Purpose],
) {
  const normalizedProof = proof.trim();
  if (!normalizedProof) return false;

  const signatureSeparatorIndex = normalizedProof.lastIndexOf(".");
  if (signatureSeparatorIndex <= 0 || signatureSeparatorIndex === normalizedProof.length - 1) {
    return false;
  }

  const payload = normalizedProof.slice(0, signatureSeparatorIndex);
  const signature = normalizedProof.slice(signatureSeparatorIndex + 1);
  const payloadParts = payload.split(":");
  if (payloadParts.length < 4) return false;

  const [proofPurpose, expiresAtRaw, nonce, ...contextParts] = payloadParts;
  if (!proofPurpose || !expiresAtRaw || !nonce || contextParts.length === 0) return false;
  if (proofPurpose !== purpose) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expectedContext = serializeProofContext(purpose, context);
  if (contextParts.join(":") !== expectedContext) return false;

  const expectedSignature = signTurnstileProof(payload);

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
