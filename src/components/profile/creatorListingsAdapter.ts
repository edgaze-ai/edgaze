import { createSupabasePublicBrowserClient } from "../../lib/supabase/public";

export type ListingType = "prompt" | "workflow";
export type ListingTab = "all" | "prompts" | "workflows";
export type ListingSort = "newest" | "popular" | "oldest";

export type CreatorListing = {
  id: string;
  type: ListingType;
  /** Table used for likes: `prompts` rows always use `prompt`, `workflows` rows use `workflow` (even when `type` is workflow-style). */
  likeItemType: ListingType;
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
  runs_count?: number | null;

  // pricing
  is_paid?: boolean | null;
  price_usd?: number | null;
  monetisation_mode?: string | null;
  featured_on_profile?: boolean | null;
  featured_on_profile_rank?: number | null;

  // legacy
  popularityLabel?: string;
};

type FetchArgs = {
  creatorId: string;
  tab: ListingTab;
  sort: ListingSort;
  limit?: number;
};

export async function fetchCreatorFeaturedListings(creatorId: string): Promise<CreatorListing[]> {
  const supabase = createSupabasePublicBrowserClient();

  const promptSelect = [
    "id",
    "type",
    "edgaze_code",
    "title",
    "description",
    "prompt_text",
    "thumbnail_url",
    "monetisation_mode",
    "is_paid",
    "price_usd",
    "views_count",
    "likes_count",
    "view_count",
    "like_count",
    "runs_count",
    "created_at",
    "featured_on_profile",
    "featured_on_profile_rank",
  ].join(",");

  const workflowSelect = [
    "id",
    "type",
    "edgaze_code",
    "title",
    "description",
    "prompt_text",
    "thumbnail_url",
    "monetisation_mode",
    "is_paid",
    "price_usd",
    "views_count",
    "likes_count",
    "runs_count",
    "created_at",
    "published_at",
    "featured_on_profile",
    "featured_on_profile_rank",
  ].join(",");

  const loadPrompts = async () => {
    const { data, error } = await supabase
      .from("prompts")
      .select(promptSelect)
      .eq("owner_id", creatorId)
      .in("type", ["prompt", "workflow"])
      .in("visibility", ["public", "unlisted"])
      .is("removed_at", null)
      .eq("featured_on_profile", true)
      .order("featured_on_profile_rank", { ascending: true, nullsFirst: false })
      .limit(3);
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: String(p.id),
      type: (p.type as any) ?? "prompt",
      likeItemType: "prompt" as const,
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
      runs_count: p.runs_count != null ? Number(p.runs_count) : null,
      is_paid: p.is_paid ?? null,
      price_usd: p.price_usd != null ? Number(p.price_usd) : null,
      monetisation_mode: (p.monetisation_mode as any) ?? null,
      featured_on_profile: p.featured_on_profile ?? null,
      featured_on_profile_rank:
        p.featured_on_profile_rank != null ? Number(p.featured_on_profile_rank) : null,
    }));
  };

  const loadWorkflows = async (select = workflowSelect) => {
    const runQuery = async (mode: "visibility" | "is_public") => {
      let builder = supabase
        .from("workflows")
        .select(select)
        .eq("owner_id", creatorId)
        .eq("is_published", true)
        .is("removed_at", null)
        .eq("featured_on_profile", true)
        .order("featured_on_profile_rank", { ascending: true, nullsFirst: false })
        .limit(3);
      if (mode === "visibility") builder = builder.in("visibility", ["public", "unlisted"]);
      else builder = builder.eq("is_public", true);
      return builder;
    };

    let res = await runQuery("visibility");
    if (res.error) {
      const msg = String((res.error as any)?.message || "");
      if (
        msg.toLowerCase().includes("visibility") &&
        msg.toLowerCase().includes("does not exist")
      ) {
        res = await runQuery("is_public");
      }
    }
    if (res.error) throw res.error;

    return (res.data ?? []).map((w: any) => ({
      id: String(w.id),
      type: (w.type as any) ?? "workflow",
      likeItemType: "workflow" as const,
      edgaze_code: w.edgaze_code ?? null,
      title: w.title ?? null,
      description: w.description ?? null,
      prompt_text: w.prompt_text ?? null,
      thumbnail_url: w.thumbnail_url ?? null,
      created_at: w.published_at ?? w.created_at ?? null,
      published_at: w.published_at ?? null,
      views_count: w.views_count != null ? Number(w.views_count) : null,
      likes_count: w.likes_count != null ? Number(w.likes_count) : null,
      runs_count: w.runs_count != null ? Number(w.runs_count) : null,
      is_paid: w.is_paid ?? null,
      price_usd: w.price_usd != null ? Number(w.price_usd) : null,
      monetisation_mode: (w.monetisation_mode as any) ?? null,
      featured_on_profile: w.featured_on_profile ?? null,
      featured_on_profile_rank:
        w.featured_on_profile_rank != null ? Number(w.featured_on_profile_rank) : null,
    }));
  };

  try {
    const [prompts, workflows] = await Promise.all([loadPrompts(), loadWorkflows()]);
    return [...prompts, ...workflows]
      .sort((a, b) => {
        const rankDiff = (a.featured_on_profile_rank ?? 99) - (b.featured_on_profile_rank ?? 99);
        if (rankDiff !== 0) return rankDiff;
        return listingTimestamp(b) - listingTimestamp(a);
      })
      .slice(0, 3);
  } catch (error) {
    if (!isMissingFeaturedColumns(error)) throw error;
    return [];
  }
}

/** Exact public listing counts for profile credibility (not capped by list fetch limits). */
export async function fetchCreatorPublicListingCounts(
  creatorId: string,
): Promise<{ prompts: number; workflows: number }> {
  const supabase = createSupabasePublicBrowserClient();

  const countWorkflows = async (): Promise<number> => {
    const run = async (mode: "visibility" | "is_public") => {
      let b = supabase
        .from("workflows")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", creatorId)
        .eq("is_published", true)
        .is("removed_at", null);
      if (mode === "visibility") b = b.in("visibility", ["public", "unlisted"]);
      else b = b.eq("is_public", true);
      return b;
    };
    let res = await run("visibility");
    if (res.error) {
      const msg = String((res.error as any)?.message || "");
      if (
        msg.toLowerCase().includes("visibility") &&
        msg.toLowerCase().includes("does not exist")
      ) {
        res = await run("is_public");
      }
    }
    if (res.error) throw res.error;
    return res.count ?? 0;
  };

  const [promptRes, workflowCount] = await Promise.all([
    supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", creatorId)
      .in("type", ["prompt", "workflow"])
      .in("visibility", ["public", "unlisted"])
      .is("removed_at", null),
    countWorkflows(),
  ]);

  if (promptRes.error) throw promptRes.error;

  return {
    prompts: promptRes.count ?? 0,
    workflows: workflowCount,
  };
}

/**
 * Fetch creator listings - matches marketplace page exactly
 */
export async function fetchCreatorListings(args: FetchArgs): Promise<CreatorListing[]> {
  const supabase = createSupabasePublicBrowserClient();

  const totalLimit = Math.max(1, Math.min(args.limit ?? 240, 240));

  const wantPrompts = args.tab === "all" || args.tab === "prompts";
  const wantWorkflows = args.tab === "all" || args.tab === "workflows";

  const [prompts, workflows] = await Promise.all([
    wantPrompts
      ? fetchPrompts(supabase, args.creatorId, args.sort, totalLimit)
      : Promise.resolve([]),
    wantWorkflows
      ? fetchWorkflows(supabase, args.creatorId, args.sort, totalLimit)
      : Promise.resolve([]),
  ]);

  if (args.tab === "prompts") return prompts.slice(0, totalLimit);
  if (args.tab === "workflows") return workflows.slice(0, totalLimit);

  return sortListings([...prompts, ...workflows], args.sort).slice(0, totalLimit);
}

function listingTimestamp(it: CreatorListing) {
  return Date.parse(it.published_at || it.created_at || "") || 0;
}

function listingPopularity(it: CreatorListing) {
  const views =
    typeof it.views_count === "number"
      ? it.views_count
      : typeof it.view_count === "number"
        ? it.view_count
        : 0;
  const likes =
    typeof it.likes_count === "number"
      ? it.likes_count
      : typeof it.like_count === "number"
        ? it.like_count
        : 0;
  const runs = typeof it.runs_count === "number" ? it.runs_count : 0;
  return views * 1 + likes * 3 + runs * 4;
}

function sortListings(listings: CreatorListing[], sort: ListingSort) {
  const ordered = [...listings];
  ordered.sort((a, b) => {
    if (sort === "popular") {
      const popDiff = listingPopularity(b) - listingPopularity(a);
      if (popDiff !== 0) return popDiff;
      return listingTimestamp(b) - listingTimestamp(a);
    }
    if (sort === "oldest") return listingTimestamp(a) - listingTimestamp(b);
    return listingTimestamp(b) - listingTimestamp(a);
  });
  return ordered;
}

function isMissingFeaturedColumns(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("featured_on_profile") &&
    (msg.includes("does not exist") || msg.includes("column"))
  );
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  limit: number,
) {
  const pageSize = Math.min(Math.max(limit, 24), 120);
  const maxItems = Math.max(limit, 120);
  const rows: T[] = [];

  for (let from = 0; from < maxItems; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await fetchPage(from, to);
    if (res.error) throw res.error;
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize || rows.length >= maxItems) break;
  }

  return rows.slice(0, maxItems);
}

async function fetchPrompts(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  creatorId: string,
  sort: ListingSort,
  limit: number,
): Promise<CreatorListing[]> {
  const selectBase = [
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
    "runs_count",
    "created_at",
  ];
  const selectWithFeatured = [
    ...selectBase,
    "featured_on_profile",
    "featured_on_profile_rank",
  ].join(",");
  const selectWithoutFeatured = selectBase.join(",");

  const runPaged = (select: string) =>
    fetchAllPages<any>((from, to) => {
      let builder = supabase
        .from("prompts")
        .select(select)
        .eq("owner_id", creatorId)
        .in("type", ["prompt", "workflow"])
        .in("visibility", ["public", "unlisted"])
        .is("removed_at", null)
        .range(from, to);

      if (sort === "newest") {
        builder = builder.order("created_at", { ascending: false });
      } else if (sort === "oldest") {
        builder = builder.order("created_at", { ascending: true });
      } else {
        builder = builder
          .order("views_count", { ascending: false, nullsFirst: false })
          .order("likes_count", { ascending: false, nullsFirst: false })
          .order("runs_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
      }

      return builder;
    }, limit);

  let data: any[] = [];
  try {
    data = await runPaged(selectWithFeatured);
  } catch (error) {
    if (!isMissingFeaturedColumns(error)) throw error;
    data = await runPaged(selectWithoutFeatured);
  }

  return data.map((p: any) => ({
    id: String(p.id),
    type: (p.type as any) ?? "prompt",
    likeItemType: "prompt",
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
    runs_count: p.runs_count != null ? Number(p.runs_count) : null,
    is_paid: p.is_paid ?? null,
    price_usd: p.price_usd != null ? Number(p.price_usd) : null,
    monetisation_mode: (p.monetisation_mode as any) ?? null,
    featured_on_profile: p.featured_on_profile ?? null,
    featured_on_profile_rank:
      p.featured_on_profile_rank != null ? Number(p.featured_on_profile_rank) : null,
  }));
}

async function fetchWorkflows(
  supabase: ReturnType<typeof createSupabasePublicBrowserClient>,
  creatorId: string,
  sort: ListingSort,
  limit: number,
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
    "runs_count",
    "created_at",
    "published_at",
    "is_published",
    "is_public",
  ].join(",");
  const featuredSelect = `${baseSelect},featured_on_profile,featured_on_profile_rank`;

  const runQuery = async (mode: "visibility" | "is_public", select: string) => {
    return fetchAllPages<any>((from, to) => {
      let builder = supabase
        .from("workflows")
        .select(select)
        .eq("owner_id", creatorId)
        .eq("is_published", true)
        .is("removed_at", null)
        .range(from, to);

      if (mode === "visibility") {
        builder = builder.in("visibility", ["public", "unlisted"]);
      } else {
        builder = builder.eq("is_public", true);
      }

      builder = builder.order("published_at", { ascending: false, nullsFirst: false });
      builder = builder.order("created_at", { ascending: false });

      if (sort === "oldest") {
        builder = builder.order("created_at", { ascending: true });
      } else if (sort === "popular") {
        builder = builder
          .order("views_count", { ascending: false, nullsFirst: false })
          .order("likes_count", { ascending: false, nullsFirst: false })
          .order("runs_count", { ascending: false, nullsFirst: false });
      }

      return builder;
    }, limit);
  };

  let data: any[] = [];
  try {
    data = await runQuery("visibility", featuredSelect);
  } catch (error) {
    const msg = String((error as any)?.message || "");
    if (isMissingFeaturedColumns(error)) {
      try {
        data = await runQuery("visibility", baseSelect);
      } catch (fallbackError) {
        const fallbackMsg = String((fallbackError as any)?.message || "");
        if (
          fallbackMsg.toLowerCase().includes("visibility") &&
          fallbackMsg.toLowerCase().includes("does not exist")
        ) {
          data = await runQuery("is_public", baseSelect);
        } else {
          throw fallbackError;
        }
      }
    } else if (
      msg.toLowerCase().includes("visibility") &&
      msg.toLowerCase().includes("does not exist")
    ) {
      data = await runQuery("is_public", featuredSelect);
    } else {
      throw error;
    }
  }

  return data.map((w: any) => ({
    id: String(w.id),
    type: (w.type as any) ?? "workflow",
    likeItemType: "workflow",
    edgaze_code: w.edgaze_code ?? null,
    title: w.title ?? null,
    description: w.description ?? null,
    prompt_text: w.prompt_text ?? null,
    thumbnail_url: w.thumbnail_url ?? null,
    created_at: w.published_at ?? w.created_at ?? null,
    published_at: w.published_at ?? null,
    views_count: w.views_count != null ? Number(w.views_count) : null,
    likes_count: w.likes_count != null ? Number(w.likes_count) : null,
    runs_count: w.runs_count != null ? Number(w.runs_count) : null,
    is_paid: w.is_paid ?? null,
    price_usd: w.price_usd != null ? Number(w.price_usd) : null,
    monetisation_mode: (w.monetisation_mode as any) ?? null,
    featured_on_profile: w.featured_on_profile ?? null,
    featured_on_profile_rank:
      w.featured_on_profile_rank != null ? Number(w.featured_on_profile_rank) : null,
  }));
}
