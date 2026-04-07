import { buildVerifiedCreatorEmailHtml } from "./buildVerifiedCreatorEmailHtml";

/** Same pattern as Supabase Edge functions: optional override, else seller-facing default. */
function verifiedEmailFrom(): string {
  const v = process.env.RESEND_FROM_EMAIL?.trim();
  if (v) return v;
  return "Edgaze <sellers@edgaze.ai>";
}

export type SendVerifiedCreatorEmailParams = {
  to: string;
  fullName?: string | null;
  handle?: string | null;
};

export async function sendVerifiedCreatorEmail(params: SendVerifiedCreatorEmailParams): Promise<{
  ok: boolean;
  error?: string;
}> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[sendVerifiedCreatorEmail] RESEND_API_KEY not set");
    return { ok: false, error: "not_configured" };
  }

  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://edgaze.ai").replace(/\/$/, "");
  const builderUrl = `${appUrl}/builder`;

  const email = params.to.trim();
  if (!email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: verifiedEmailFrom(),
        to: [email],
        subject: "You are now verified on Edgaze",
        html: buildVerifiedCreatorEmailHtml({
          email,
          fullName: params.fullName ?? null,
          handle: params.handle ?? null,
          builderUrl,
        }),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      console.warn("[sendVerifiedCreatorEmail] Resend error:", res.status, data);
      return { ok: false, error: data?.message || `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[sendVerifiedCreatorEmail]", e);
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}
