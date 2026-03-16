import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 1800; // 30 min — new products and profiles appear in sitemap within ~30 min

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://edgaze.ai";
}

type WorkflowRow = { owner_handle: string | null; edgaze_code: string | null };
type PromptRow = { owner_handle: string | null; edgaze_code: string | null };
type ProfileRow = { handle: string | null };

export async function GET() {
  const base = getBaseUrl();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If env not set, fail gracefully (sitemap.ts will fall back to static routes)
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ urls: [] }, { status: 200 });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const urls: string[] = [];

  // All published workflows (not removed) — new ones are included on next revalidate
  const { data: workflows } = await sb
    .from("workflows")
    .select("owner_handle, edgaze_code")
    .eq("is_published", true)
    .is("removed_at", null);

  for (const w of (workflows ?? []) as WorkflowRow[]) {
    if (!w.owner_handle || !w.edgaze_code) continue;
    urls.push(`${base}/${w.owner_handle}/${w.edgaze_code}`);
  }

  // All published prompts (not removed) — new ones are included on next revalidate
  const { data: prompts } = await sb
    .from("prompts")
    .select("owner_handle, edgaze_code")
    .eq("is_published", true)
    .is("removed_at", null);

  for (const p of (prompts ?? []) as PromptRow[]) {
    if (!p.owner_handle || !p.edgaze_code) continue;
    urls.push(`${base}/p/${p.owner_handle}/${p.edgaze_code}`);
  }

  // All profiles with a handle — new profiles are included on next revalidate
  const { data: profiles } = await sb
    .from("profiles")
    .select("handle")
    .not("handle", "is", null);

  for (const row of (profiles ?? []) as ProfileRow[]) {
    const handle = row.handle?.trim();
    if (!handle) continue;
    urls.push(`${base}/profile/${encodeURIComponent(handle)}`);
  }

  // de-dupe
  const uniq = Array.from(new Set(urls));

  return NextResponse.json({ urls: uniq }, { status: 200 });
}
