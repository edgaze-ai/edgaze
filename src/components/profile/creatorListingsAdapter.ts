import { createSupabasePublicBrowserClient } from "../../lib/supabase/public";

export type ListingType = "prompt" | "workflow";
export type ListingTab = "all" | "prompts" | "workflows";
export type ListingSort = "newest" | "popular" | "oldest";

export type CreatorListing = {
  id: string;
  title: string;
  type: ListingType;
  createdAt?: string | null;
  thumbnailUrl?: string | null;
  popularityLabel?: string;
};

type FetchArgs = {
  creatorId: string;
  tab: ListingTab;
  sort: ListingSort;
  limit?: number; // total limit for tab=all, per-type limit for others
};

/**
 * Bulletproof creator listings adapter.
 * - Tables: prompts, workflows
 * - Creator field: owner_id
 * - Supports sorting: newest/popular/oldest
 * - Interleaves prompts/workflows for equal weight on "all"
 * - Progressive fallback if some columns do not exist yet
 */
export async function fetchCreatorListings(args: FetchArgs): Promise<CreatorListing[]> {
  const supabase = createSupabasePublicBrowserClient();

  const totalLimit = Math.max(1, Math.min(args.limit ?? 48, 96));

  const wantPrompts = args.tab === "all" || args.tab === "prompts";
  const wantWorkflows = args.tab === "all" || args.tab === "workflows";

  // For "all", split budget across both to keep equal weight.
  const perTypeLimit =
    args.tab === "all" ? Math.max(6, Math.ceil(totalLimit / 2)) : totalLimit;

  const [prompts, workflows] = await Promise.all([
    wantPrompts ? fetchTableSafe(supabase, "prompts", "prompt", args.creatorId, args.sort, perTypeLimit) : Promise.resolve([]),
    wantWorkflows ? fetchTableSafe(supabase, "workflows", "workflow", args.creatorId, args.sort, perTypeLimit) : Promise.resolve([]),
  ]);

  if (args.tab === "prompts") return prompts.slice(0, totalLimit);
  if (args.tab === "workflows") return workflows.slice(0, totalLimit);

  // Interleave for equal weight when both exist
  return interleaveEqual(prompts, workflows).slice(0, totalLimit);
}

function interleaveEqual(a: CreatorListing[], b: CreatorListing[]) {
  const out: CreatorListing[] = [];
  const n = Math.max(a.length, b.length);

  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

async function fetchTableSafe(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  table: "prompts" | "workflows",
  type: ListingType,
  creatorId: string,
  sort: ListingSort,
  limit: number
): Promise<CreatorListing[]> {
  // We progressively try richer selects/filters, then fall back if your schema is missing columns.
  // This prevents the adapter from breaking during migrations.

  const baseFilters = [{ col: "owner_id", op: "eq" as const, val: creatorId }];

  // Prefer public + published if available (your UX implies only public uploads on profile)
  const visibilityFilters = [
    { col: "is_public", op: "eq" as const, val: true },
    { col: "is_published", op: "eq" as const, val: true },
  ];

  // Select candidates from most-complete to least-complete
  const selectCandidates = [
    // richest
    "id,title,created_at,thumbnail_url,banner_url,views_count,runs_count,likes_count,is_public,is_published",
    // without is_public/is_published
    "id,title,created_at,thumbnail_url,banner_url,views_count,runs_count,likes_count",
    // without popularity cols
    "id,title,created_at,thumbnail_url,banner_url",
    // minimal
    "id,title,created_at",
    "id,title",
  ];

  // Try with public/published filters first; if columns missing, try without them.
  const attempts: Array<{
    select: string;
    includeVisibility: boolean;
  }> = [];

  for (const s of selectCandidates) {
    attempts.push({ select: s, includeVisibility: true });
  }
  for (const s of selectCandidates) {
    attempts.push({ select: s, includeVisibility: false });
  }

  let lastErr: any = null;

  for (const attempt of attempts) {
    try {
      let q = supabase.from(table).select(attempt.select);

      for (const f of baseFilters) {
        q = q.eq(f.col, f.val);
      }

      if (attempt.includeVisibility) {
        for (const f of visibilityFilters) {
          // If these cols don't exist, Supabase will throw and we’ll fall back.
          q = q.eq(f.col, f.val);
        }
      }

      // Sorting
      if (sort === "newest") {
        q = q.order("created_at", { ascending: false });
      } else if (sort === "oldest") {
        q = q.order("created_at", { ascending: true });
      } else {
        // popular
        // Prefer views_count > runs_count > likes_count when available.
        // If a column doesn't exist, the attempt will throw; fallback handles it.
        q = q
          .order("views_count", { ascending: false, nullsFirst: false })
          .order("runs_count", { ascending: false, nullsFirst: false })
          .order("likes_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
      }

      const { data, error } = await q.limit(limit);
      if (error) throw error;

      return (data || []).map((row: any) => normalizeRow(row, type));
    } catch (e: any) {
      lastErr = e;
      // continue to next attempt
    }
  }

  // If everything failed, throw a clean error.
  const msg = lastErr?.message || String(lastErr) || "Unknown error";
  throw new Error(`Failed to load ${table} listings: ${msg}`);
}

function normalizeRow(row: any, type: ListingType): CreatorListing {
  const title = String(row?.title ?? "").trim() || (type === "prompt" ? "Untitled prompt" : "Untitled workflow");

  const views = numOrNull(row?.views_count);
  const runs = numOrNull(row?.runs_count);
  const likes = numOrNull(row?.likes_count);

  const popularityLabel =
    views != null ? `${views} views`
    : runs != null ? `${runs} runs`
    : likes != null ? `${likes} likes`
    : undefined;

  // Prefer thumbnail_url, else banner_url
  const thumbnailUrl =
    typeof row?.thumbnail_url === "string" && row.thumbnail_url.trim()
      ? row.thumbnail_url.trim()
      : typeof row?.banner_url === "string" && row.banner_url.trim()
        ? row.banner_url.trim()
        : null;

  return {
    id: String(row?.id),
    title,
    type,
    createdAt: typeof row?.created_at === "string" ? row.created_at : null,
    thumbnailUrl,
    popularityLabel,
  };
}

function numOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
