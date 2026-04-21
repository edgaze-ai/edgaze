// src/app/api/turnstile/verify/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getTurnstileCookieName, issueTurnstileProof } from "src/server/security/turnstile-proof";
import { extractTrustedClientIpOrUnknown } from "@lib/request-client-ip";
import {
  getWorkflowDemoUserAgent,
  normalizeWorkflowDemoFingerprint,
} from "src/server/security/workflow-demo-identity";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return json(500, { ok: false, error: "Missing TURNSTILE_SECRET_KEY" });

  const ip = extractTrustedClientIpOrUnknown(req);

  const { token, purpose, workflowId, deviceFingerprint } = await req
    .json()
    .catch(() => ({ token: "", purpose: "" }));
  if (!token || typeof token !== "string")
    return json(400, { ok: false, error: "Captcha required" });

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data: any = await resp.json().catch(() => null);
  if (!data?.success) {
    return json(400, { ok: false, error: "Captcha invalid", codes: data?.["error-codes"] || [] });
  }

  const res = json(200, { ok: true });
  const isWorkflowDemo = purpose === "workflow_demo";
  let proof: string = randomUUID();
  if (isWorkflowDemo) {
    const normalizedWorkflowId = typeof workflowId === "string" ? workflowId.trim() : "";
    const normalizedFingerprint = normalizeWorkflowDemoFingerprint(deviceFingerprint);
    if (!normalizedWorkflowId || !normalizedFingerprint) {
      return json(400, { ok: false, error: "workflowId and deviceFingerprint are required" });
    }
    proof = issueTurnstileProof("workflow_demo", {
      workflowId: normalizedWorkflowId,
      deviceFingerprint: normalizedFingerprint,
      ipAddress: ip,
      userAgent: getWorkflowDemoUserAgent(req),
    });
  }
  const cookieName = isWorkflowDemo
    ? getTurnstileCookieName("workflow_demo")
    : "edgaze_apply_captcha";
  res.headers.append(
    "set-cookie",
    [
      `${cookieName}=${proof}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=1200",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );

  return res;
}
