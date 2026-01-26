import { createSupabasePublicBrowserClient } from "../../lib/supabase/public";

export type ListingType = "prompt" | "workflow";
export type ListingTab = "all" | "prompts" | "workflows";
export type ListingSort = "newest" | "popular" | "oldest";

export type CreatorListing = {
  id: string;
  type: ListingType;
  title?: string | null;
  description?: string | null;
  prompt_text?: string | null;
  thumbnail_url?: string | null;
  edgaze_code?: string | null;
  created_at?: string | null;
  published_at?: string | null;
  
  // counts (varies by table)
  views_count?: number | null;
  view_count?: number | null;
  likes_count?: number | null;
  like_count?: number | null;
  
  // pricing
  is_paid?: boolean | null;
  price_usd?: number | null;
  monetisation_mode?: string | null;
  
  // legacy
  popularityLabel?: string;
};

type FetchArgs = {
  creatorId: string;
  tab: ListingTab;
  sort: ListingSort;
  limit?: number;
};

/**
 * Fetch creator listings - matches marketplace page exactly
 */
export async function fetchCreatorListings(args: FetchArgs): Promise<CreatorListing[]> {
  const supabase = createSupabasePublicBrowserClient();

  const totalLimit = Math.max(1, Math.min(args.limit ?? 48, 96));

  const wantPrompts = args.tab === "all" || args.tab === "prompts";
  const wantWorkflows = args.tab === "all" || args.tab === "workflows";

  const perTypeLimit =
    args.tab === "all" ? Math.max(6, Math.ceil(totalLimit / 2)) : totalLimit;

  const [prompts, workflows] = await Promise.all([
    wantPrompts ? fetchPrompts(supabase, args.creatorId, args.sort, perTypeLimit) : Promise.resolve([]),
    wantWorkflows ? fetchWorkflows(supabase, args.creatorId, args.sort, perTypeLimit) : Promise.resolve([]),
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
    const ai = a[i];
    if (ai) out.push(ai);
    const bi = b[i];
    if (bi) out.push(bi);
  }

  return out;
}

async function fetchPrompts(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  creatorId: string,
  sort: ListingSort,
  limit: number
): Promise<CreatorListing[]> {
  let builder = supabase
    .from("prompts")
    .select(
      [
        "id",
        "type",
        "edgaze_code",
        "title",
        "description",
        "prompt_text",
        "thumbnail_url",
        "tags",
        "visibility",
        "monetisation_mode",
        "is_paid",
        "price_usd",
        "views_count",
        "likes_count",
        "view_count",
        "like_count",
        "created_at",
      ].join(",")
    )
    .eq("owner_id", creatorId)
    .in("type", ["prompt", "workflow"])
    .in("visibility", ["public", "unlisted"])
    .limit(limit);

  // Sorting
  if (sort === "newest") {
    builder = builder.order("created_at", { ascending: false });
  } else if (sort === "oldest") {
    builder = builder.order("created_at", { ascending: true });
  } else {
    // popular
    builder = builder
      .order("views_count", { ascending: false, nullsFirst: false })
      .order("likes_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  const { data, error } = await builder;
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: String(p.id),
    type: (p.type as any) ?? "prompt",
    edgaze_code: p.edgaze_code ?? null,
    title: p.title ?? null,
    description: p.description ?? null,
    prompt_text: p.prompt_text ?? null,
    thumbnail_url: p.thumbnail_url ?? null,
    created_at: p.created_at ?? null,
    views_count: p.views_count != null ? Number(p.views_count) : null,
    view_count: p.view_count != null ? Number(p.view_count) : null,
    likes_count: p.likes_count != null ? Number(p.likes_count) : null,
    like_count: p.like_count != null ? Number(p.like_count) : null,
    is_paid: p.is_paid ?? null,
    price_usd: p.price_usd != null ? Number(p.price_usd) : null,
    monetisation_mode: (p.monetisation_mode as any) ?? null,
  }));
}

async function fetchWorkflows(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  creatorId: string,
  sort: ListingSort,
  limit: number
): Promise<CreatorListing[]> {
  const baseSelect = [
    "id",
    "type",
    "edgaze_code",
    "title",
    "description",
    "prompt_text",
    "thumbnail_url",
    "tags",
    "visibility",
    "monetisation_mode",
    "is_paid",
    "price_usd",
    "views_count",
    "likes_count",
    "created_at",
    "published_at",
    "is_published",
    "is_public",
  ].join(",");

  const runQuery = async (mode: "visibility" | "is_public") => {
    let builder = supabase
      .from("workflows")
      .select(baseSelect)
      .eq("owner_id", creatorId)
      .eq("is_published", true)
      .limit(limit);

    if (mode === "visibility") {
      builder = builder.in("visibility", ["public", "unlisted"]);
    } else {
      builder = builder.eq("is_public", true);
    }

    // Sorting
    builder = builder.order("published_at", { ascending: false, nullsFirst: false });
    builder = builder.order("created_at", { ascending: false });

    if (sort === "oldest") {
      builder = builder.order("created_at", { ascending: true });
    } else if (sort === "popular") {
      builder = builder
        .order("views_count", { ascending: false, nullsFirst: false })
        .order("likes_count", { ascending: false, nullsFirst: false });
    }

    return await builder;
  };

  let res = await runQuery("visibility");
  if (res.error) {
    const msg = String((res.error as any)?.message || "");
    if (msg.toLowerCase().includes("visibility") && msg.toLowerCase().includes("does not exist")) {
      res = await runQuery("is_public");
    }
  }
  if (res.error) throw res.error;

  return (res.data ?? []).map((w: any) => ({
    id: String(w.id),
    type: (w.type as any) ?? "workflow",
    edgaze_code: w.edgaze_code ?? null,
    title: w.title ?? null,
    description: w.description ?? null,
    prompt_text: w.prompt_text ?? null,
    thumbnail_url: w.thumbnail_url ?? null,
    created_at: w.published_at ?? w.created_at ?? null,
    published_at: w.published_at ?? null,
    views_count: w.views_count != null ? Number(w.views_count) : null,
    likes_count: w.likes_count != null ? Number(w.likes_count) : null,
    is_paid: w.is_paid ?? null,
    price_usd: w.price_usd != null ? Number(w.price_usd) : null,
    monetisation_mode: (w.monetisation_mode as any) ?? null,
  }));
}
