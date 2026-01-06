import { NextResponse } from "next/server";

export const revalidate = 1800; // 30 min cache at the edge (stable + fast)

function baseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type SupabaseResponse<T> = { data?: T; error?: any };

async function sbGet<T>(path: string): Promise<SupabaseResponse<T>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { data: undefined, error: { message: "Missing Supabase env vars" } };
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    // avoid any weird caching issues
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) return { data: undefined, error: json ?? { status: res.status } };
  return { data: json as T, error: null };
}

export async function GET() {
  const site = baseUrl();

  // Prompts: /p/[ownerHandle]/[edgazeCode]
  const promptsRes = await sbGet<
    Array<{ owner_handle: string; edgaze_code: string; updated_at?: string }>
  >(
    // Adjust filters if your schema differs; these are typical for "public + published"
    "prompts?select=owner_handle,edgaze_code,updated_at&is_public=eq.true&is_published=eq.true&edgaze_code=not.is.null&owner_handle=not.is.null&limit=50000"
  );

  // Workflows: /[ownerHandle]/[slug]  (fallback to edgaze_code if slug missing)
  const workflowsRes = await sbGet<
    Array<{
      owner_handle: string;
      slug: string | null;
      edgaze_code: string | null;
      updated_at?: string;
    }>
  >(
    "workflows?select=owner_handle,slug,edgaze_code,updated_at&is_public=eq.true&is_published=eq.true&owner_handle=not.is.null&limit=50000"
  );

  // If Supabase errors, return empty list (sitemap still works)
  const promptUrls =
    promptsRes.data?.map(
      (p) => `${site}/p/${encodeURIComponent(p.owner_handle)}/${encodeURIComponent(p.edgaze_code)}`
    ) ?? [];

  const workflowUrls =
    workflowsRes.data?.flatMap((w) => {
      const handle = w.owner_handle;
      const slug = w.slug?.trim();
      const code = w.edgaze_code?.trim();

      // IMPORTANT: choose the URL your app actually uses
      // If your route is /[ownerHandle]/[slug], this is correct.
      // If your route is /[ownerHandle]/[edgazeCode], change to use `code`.
      const id = code;
      if (!handle || !id) return [];
      return [`${site}/${encodeURIComponent(handle)}/${encodeURIComponent(id)}`];
    }) ?? [];

  const urls = [...promptUrls, ...workflowUrls];

  return NextResponse.json({ urls });
}
