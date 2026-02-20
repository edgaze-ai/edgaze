// Edgaze Welcome Email - sent after email confirmation / first sign-in
// Fails silently if Resend is out of credits - never exposes errors to users
// Supports light and dark mode via prefers-color-scheme

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "Edgaze <onboarding@edgaze.ai>";
const APP_URL = Deno.env.get("EDGAZE_APP_URL") ?? "https://edgaze.ai";
const LOGO_URL = "https://edgaze.ai/brand/edgaze-mark.png";

function buildWelcomeHtml(params: {
  email: string;
  fullName?: string | null;
  handle?: string | null;
}): string {
  const name = params.fullName || params.handle || params.email.split("@")[0] || "there";
  const firstName = name.split(" ")[0] || name;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Welcome to Edgaze — Create & Sell AI Products</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0c0c0e !important; background-image: none !important; }
      .card-bg { background-color: #18181b !important; }
      .card-border { border-color: rgba(6,182,212,0.2) !important; }
      .text-heading { color: #fafafa !important; }
      .text-body { color: #d4d4d8 !important; }
      .text-muted { color: #a1a1aa !important; }
      .text-footer { color: #71717a !important; }
      .feature-bg { background-color: #27272a !important; border-color: #3f3f46 !important; }
      .divider { border-color: #3f3f46 !important; }
      .logo-brightness { filter: brightness(1.1); }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:linear-gradient(135deg, #f0f9ff 0%, #fdf2f8 50%, #f0f9ff 100%);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background:linear-gradient(135deg, #f0f9ff 0%, #fdf2f8 50%, #f0f9ff 100%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:56px 24px 64px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card-bg card-border" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(6,182,212,0.1),0 8px 40px rgba(236,72,153,0.06);border:1px solid rgba(6,182,212,0.15);">
          <!-- Gradient header -->
          <tr>
            <td style="padding:0;background:linear-gradient(90deg, #06b6d4 0%, #ec4899 50%, #06b6d4 100%);height:8px;"></td>
          </tr>
          <!-- Logo & hero -->
          <tr>
            <td style="padding:56px 56px 32px;text-align:center;">
              <img src="${LOGO_URL}" alt="Edgaze" width="140" height="48" class="logo-brightness" style="display:inline-block;height:48px;width:auto;max-width:140px;object-fit:contain;" />
              <p class="text-muted" style="margin:20px 0 0;font-size:16px;font-weight:500;letter-spacing:0.03em;color:#64748b;">Create, sell & distribute AI products</p>
            </td>
          </tr>
          <!-- Main content -->
          <tr>
            <td style="padding:0 56px 40px;">
              <h1 class="text-heading" style="margin:0 0 24px;font-size:28px;font-weight:700;color:#0f172a;line-height:1.25;letter-spacing:-0.02em;">Hey ${firstName}! 👋</h1>
              <p class="text-body" style="margin:0 0 24px;font-size:17px;color:#475569;line-height:1.75;">Welcome to Edgaze. You're all set — your account is ready and you're part of a community of creators turning AI into products people love.</p>
              <p class="text-body" style="margin:0 0 32px;font-size:17px;color:#475569;line-height:1.75;">Here's everything you can do to get started:</p>

              <!-- Feature cards -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td class="feature-bg" style="padding:24px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:16px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#06b6d4;letter-spacing:0.05em;text-transform:uppercase;">Marketplace</p>
                    <p class="text-body" style="margin:0;font-size:16px;color:#475569;line-height:1.6;">Browse prompts and workflows built by other creators. Discover templates, copy what works, and get inspired.</p>
                  </td>
                </tr>
                <tr><td style="height:16px;"></td></tr>
                <tr>
                  <td class="feature-bg" style="padding:24px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#ec4899;letter-spacing:0.05em;text-transform:uppercase;">Prompt Studio</p>
                    <p class="text-body" style="margin:0;font-size:16px;color:#475569;line-height:1.6;">Create and refine your prompts, package them into products, set your price, and start selling. No code required.</p>
                  </td>
                </tr>
                <tr><td style="height:16px;"></td></tr>
                <tr>
                  <td class="feature-bg" style="padding:24px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#06b6d4;letter-spacing:0.05em;text-transform:uppercase;">Workflow Builder</p>
                    <p class="text-body" style="margin:0;font-size:16px;color:#475569;line-height:1.6;">Build no-code AI workflows visually. Connect models, tools, and logic — then share or sell them to your audience.</p>
                  </td>
                </tr>
              </table>

              <p class="text-body" style="margin:0 0 32px;font-size:16px;color:#475569;line-height:1.7;">Whether you're a creator, developer, or entrepreneur, Edgaze gives you the tools to turn ideas into products and grow your audience.</p>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(90deg, #06b6d4 0%, #ec4899 100%);color:#ffffff !important;font-size:17px;font-weight:600;text-decoration:none;padding:18px 40px;border-radius:14px;box-shadow:0 4px 20px rgba(6,182,212,0.4);">Explore Edgaze</a>
                  </td>
                </tr>
              </table>

              <div class="divider" style="border-top:1px solid #e2e8f0;padding-top:32px;margin-top:8px;">
                <p class="text-muted" style="margin:0 0 12px;font-size:15px;color:#64748b;line-height:1.6;">Need help? Reply to this email or reach out in our community. We're here to help you succeed.</p>
                <p class="text-muted" style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">— The Edgaze team</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="divider text-footer" style="padding:32px 56px 48px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">You received this because you signed up at Edgaze.</p>
              <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">© ${year} Edgaze. All rights reserved.</p>
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
        subject: "Welcome to Edgaze — Create & Sell AI Products",
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
