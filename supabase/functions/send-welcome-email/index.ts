// EdGaze Welcome Email - sent on every new signup (email + OAuth)
// Fails silently if Resend is out of credits - never exposes errors to users

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "EdGaze <onboarding@edgaze.ai>";
const APP_URL = Deno.env.get("EDGAZE_APP_URL") ?? "https://edgaze.ai";

function buildWelcomeHtml(params: {
  email: string;
  fullName?: string | null;
  handle?: string | null;
}): string {
  const name = params.fullName || params.handle || params.email.split("@")[0] || "there";
  const firstName = name.split(" ")[0] || name;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to EdGaze</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">EdGaze</p>
              <p style="margin:8px 0 0;font-size:14px;color:#a1a1aa;">Create, sell & distribute AI products</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#fafafa;line-height:1.3;">Hey ${firstName}! 👋</h1>
              <p style="margin:0 0 20px;font-size:16px;color:#d4d4d8;line-height:1.6;">Welcome to EdGaze. You're one step away from turning your AI prompts and workflows into products people can use and buy.</p>
              <p style="margin:0 0 28px;font-size:16px;color:#d4d4d8;line-height:1.6;">Here's what you can do next:</p>
              <ul style="margin:0 0 28px;padding-left:20px;color:#d4d4d8;font-size:15px;line-height:1.8;">
                <li>Browse the marketplace for ready-to-use prompts and workflows</li>
                <li>Create your own in Prompt Studio and sell them</li>
                <li>Build no-code AI workflows with the visual builder</li>
              </ul>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Explore EdGaze</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 40px;border-top:1px solid #27272a;">
              <p style="margin:0;font-size:12px;color:#71717a;">You received this because you signed up at EdGaze.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#71717a;">© ${new Date().getFullYear()} EdGaze. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }

  if (!RESEND_API_KEY) {
    console.warn("[send-welcome-email] RESEND_API_KEY not set, skipping");
    return new Response(JSON.stringify({ ok: false, reason: "not_configured" }), { status: 200 });
  }

  let body: { email?: string; full_name?: string | null; handle?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : null;
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Welcome to EdGaze — Create & Sell AI Products",
        html: buildWelcomeHtml({
          email,
          fullName: body.full_name ?? null,
          handle: body.handle ?? null,
        }),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[send-welcome-email] Resend error:", res.status, data);
      return new Response(JSON.stringify({ ok: false }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.warn("[send-welcome-email] Error:", err);
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }
});
