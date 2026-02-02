// src/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Types sent back to the client
export type ProfileHit = {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
};

export type WorkflowHit = {
  id: string;
  title: string;
  slug: string | null;
  bannerUrl: string | null;
};

export type SearchResult = {
  query: string;
  profiles: ProfileHit[];
  workflows: WorkflowHit[];
};

const MAX_QUERY_LENGTH = 150;

/** Escape LIKE wildcards so user input is matched literally (prevents pattern abuse) */
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  let q = (url.searchParams.get("q") || "").trim();

  // Empty query → empty results, but still 200
  if (!q) {
    const empty: SearchResult = { query: "", profiles: [], workflows: [] };
    return NextResponse.json(empty);
  }

  // Enforce max length to prevent abuse
  if (q.length > MAX_QUERY_LENGTH) {
    q = q.slice(0, MAX_QUERY_LENGTH);
  }

  // If Supabase is not configured yet, return empty but don't crash the UI
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Supabase env vars missing, returning empty search result");
    const empty: SearchResult = { query: q, profiles: [], workflows: [] };
    return NextResponse.json(empty);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const escaped = escapeLikePattern(q);
    // ---- Profiles search ----
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .or(
        `display_name.ilike.%${escaped}%,handle.ilike.%${escaped}%` // name or handle (escaped to prevent LIKE wildcard abuse)
      )
      .limit(5);

    if (profileError) {
      console.error("Profile search error", profileError);
    }

    const profiles: ProfileHit[] =
      profileRows?.map((p: any) => ({
        id: p.id,
        displayName: p.display_name ?? "Creator",
        handle: p.handle ?? null,
        avatarUrl: p.avatar_url ?? null,
      })) ?? [];

    // ---- Workflows search ----
    const { data: workflowRows, error: workflowError } = await supabase
      .from("workflows")
      .select("id, title, slug, banner_url, is_public")
      .eq("is_public", true)
      .ilike("title", `%${escaped}%`)
      .limit(5);

    if (workflowError) {
      console.error("Workflow search error", workflowError);
    }

    const workflows: WorkflowHit[] =
      workflowRows?.map((w: any) => ({
        id: w.id,
        title: w.title ?? "Untitled workflow",
        slug: w.slug ?? null,
        bannerUrl: w.banner_url ?? null,
      })) ?? [];

    const result: SearchResult = {
      query: q,
      profiles,
      workflows,
    };

    // Always 200 with a valid JSON body
    return NextResponse.json(result);
  } catch (err) {
    console.error("Search API fatal error", err);
    const fallback: SearchResult = {
      query: q,
      profiles: [],
      workflows: [],
    };
    return NextResponse.json(fallback);
  }
}
