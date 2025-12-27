// src/app/api/turnstile/verify/route.ts
import { NextResponse } from "next/server";

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

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";

  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token || typeof token !== "string") return json(400, { ok: false, error: "Captcha required" });

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

  // Server-issued proof. Short TTL, but longer than the raw token.
  const proof = crypto.randomUUID();

  const res = json(200, { ok: true });
  res.headers.append(
    "set-cookie",
    [
      `edgaze_apply_captcha=${proof}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      // 20 minutes is more than enough for sign-in + 10s animation
      "Max-Age=1200",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );

  return res;
}
