/**
 * Marketplace listings API - uses admin client to bypass RLS.
 * Fixes marketplace loading when direct Supabase anon client is blocked by RLS.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const PAGE_SIZE = 9;

export type MarketplaceListingItem = {
  id: string;
  owner_id: string | null;
  type: string;
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  prompt_text: string | null;
  thumbnail_url: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  tags: string | null;
  visibility: string | null;
  monetisation_mode: string | null;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
  created_at: string | null;
  published_at: string | null;
};

export type MarketplaceListingsResponse = {
  prompts: MarketplaceListingItem[];
  workflows: MarketplaceListingItem[];
};

function mapPrompt(row: Record<string, unknown>): MarketplaceListingItem {
  return {
    id: String(row.id ?? ""),
    owner_id: row.owner_id != null ? String(row.owner_id) : null,
    type: (row.type as string) ?? "prompt",
    edgaze_code: (row.edgaze_code as string) ?? null,
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    prompt_text: (row.prompt_text as string) ?? null,
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    owner_handle: (row.owner_handle as string) ?? null,
    tags: (row.tags as string) ?? null,
    visibility: (row.visibility as string) ?? null,
    monetisation_mode: (row.monetisation_mode as string) ?? null,
    is_paid: (row.is_paid as boolean) ?? null,
    price_usd: row.price_usd != null ? Number(row.price_usd) : null,
    view_count:
      row.views_count != null
        ? Number(row.views_count)
        : row.view_count != null
          ? Number(row.view_count)
          : null,
    like_count:
      row.likes_count != null
        ? Number(row.likes_count)
        : row.like_count != null
          ? Number(row.like_count)
          : null,
    created_at: (row.created_at as string) ?? null,
    published_at: null,
  };
}

function mapWorkflow(row: Record<string, unknown>): MarketplaceListingItem {
  return {
    id: String(row.id ?? ""),
    owner_id: row.owner_id != null ? String(row.owner_id) : null,
    type: (row.type as string) ?? "workflow",
    edgaze_code: (row.edgaze_code as string) ?? null,
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    prompt_text: (row.prompt_text as string) ?? null,
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    owner_handle: (row.owner_handle as string) ?? null,
    tags: (row.tags as string) ?? null,
    visibility: (row.visibility as string) ?? (row.is_public ? "public" : null),
    monetisation_mode: (row.monetisation_mode as string) ?? null,
    is_paid: (row.is_paid as boolean) ?? null,
    price_usd: row.price_usd != null ? Number(row.price_usd) : null,
    view_count: row.views_count != null ? Number(row.views_count) : null,
    like_count: row.likes_count != null ? Number(row.likes_count) : null,
    created_at: (row.published_at as string) ?? (row.created_at as string) ?? null,
    published_at: (row.published_at as string) ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const sort = (searchParams.get("sort") ?? "newest") as "newest" | "popular";
    const contentType = (searchParams.get("contentType") ?? "all") as "all" | "prompt" | "workflow";
    const topic = searchParams.get("topic");
    const topicsRaw = searchParams.get("topics");
    const topics: string[] = topicsRaw ? (JSON.parse(topicsRaw) as string[]) : [];
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax");
    const promptsOffset = Math.max(0, parseInt(searchParams.get("promptsOffset") ?? "0", 10));
    const workflowsOffset = Math.max(0, parseInt(searchParams.get("workflowsOffset") ?? "0", 10));

    const priceMinNum = priceMin ? parseFloat(priceMin) : null;
    const priceMaxNum = priceMax ? parseFloat(priceMax) : null;

    const supabase = createSupabaseAdminClient();

    const promptsSelect = [
      "id",
      "owner_id",
      "type",
      "edgaze_code",
      "title",
      "description",
      "prompt_text",
      "thumbnail_url",
      "owner_name",
      "owner_handle",
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
    ].join(",");

    const workflowsSelect = [
      "id",
      "owner_id",
      "type",
      "edgaze_code",
      "title",
      "description",
      "prompt_text",
      "thumbnail_url",
      "owner_name",
      "owner_handle",
      "tags",
      "visibility",
      "monetisation_mode",
      "is_paid",
      "price_usd",
      "views_count",
      "likes_count",
      "created_at",
      "published_at",
      "is_public",
    ].join(",");

    // Fetch prompts (skip if contentType === "workflow")
    let prompts: MarketplaceListingItem[] = [];
    if (contentType !== "workflow") {
      let builder = supabase
        .from("prompts")
        .select(promptsSelect)
        .in("type", contentType === "prompt" ? ["prompt"] : ["prompt", "workflow"])
        .in("visibility", ["public", "unlisted"])
        .is("removed_at", null)
        .range(promptsOffset, promptsOffset + PAGE_SIZE - 1);

      if (sort === "popular") {
        builder = builder
          .order("views_count", { ascending: false, nullsFirst: false })
          .order("likes_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
      } else {
        builder = builder.order("created_at", { ascending: false });
      }

      if (q) {
        builder = builder.or(
          [
            `title.ilike.%${q}%`,
            `description.ilike.%${q}%`,
            `tags.ilike.%${q}%`,
            `owner_name.ilike.%${q}%`,
            `owner_handle.ilike.%${q}%`,
            `edgaze_code.ilike.%${q}%`,
          ].join(","),
        );
      }
      if (topic) builder = builder.ilike("tags", `%${topic}%`);
      if (topics.length > 0) {
        builder = builder.or(topics.map((t) => `tags.ilike.%${t}%`).join(","));
      }
      if (priceMinNum != null) builder = builder.gte("price_usd", priceMinNum);
      if (priceMaxNum != null) builder = builder.lte("price_usd", priceMaxNum);

      const { data, error } = await builder;
      if (error) {
        console.error("[marketplace/listings] Prompts error:", error);
      } else {
        prompts = (data ?? []).map((p) => mapPrompt(p as unknown as Record<string, unknown>));
      }
    }

    // Fetch workflows (skip if contentType === "prompt")
    let workflows: MarketplaceListingItem[] = [];
    if (contentType !== "prompt") {
      const runWorkflowsQuery = async (useVisibility: boolean) => {
        let builder = supabase
          .from("workflows")
          .select(workflowsSelect)
          .eq("is_published", true)
          .is("removed_at", null)
          .range(workflowsOffset, workflowsOffset + PAGE_SIZE - 1);

        if (useVisibility) {
          builder = builder.in("visibility", ["public", "unlisted"]);
        } else {
          builder = builder.eq("is_public", true);
        }

        if (sort === "popular") {
          builder = builder
            .order("views_count", { ascending: false, nullsFirst: false })
            .order("likes_count", { ascending: false, nullsFirst: false })
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
        } else {
          builder = builder
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
        }

        if (q) {
          builder = builder.or(
            [
              `title.ilike.%${q}%`,
              `description.ilike.%${q}%`,
              `tags.ilike.%${q}%`,
              `owner_name.ilike.%${q}%`,
              `owner_handle.ilike.%${q}%`,
              `edgaze_code.ilike.%${q}%`,
            ].join(","),
          );
        }
        if (topic) builder = builder.ilike("tags", `%${topic}%`);
        if (topics.length > 0) {
          builder = builder.or(topics.map((t) => `tags.ilike.%${t}%`).join(","));
        }
        if (priceMinNum != null) builder = builder.gte("price_usd", priceMinNum);
        if (priceMaxNum != null) builder = builder.lte("price_usd", priceMaxNum);

        return await builder;
      };

      let wRes = await runWorkflowsQuery(true);
      if (wRes.error) {
        const msg = String((wRes.error as { message?: string })?.message ?? "").toLowerCase();
        if (msg.includes("visibility") || msg.includes("column")) {
          wRes = await runWorkflowsQuery(false);
        }
      }
      if (wRes.error) {
        console.error("[marketplace/listings] Workflows error:", wRes.error);
      } else {
        workflows = (wRes.data ?? []).map((w) =>
          mapWorkflow(w as unknown as Record<string, unknown>),
        );
      }
    }

    const response: MarketplaceListingsResponse = { prompts, workflows };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[marketplace/listings] Error:", err);
    return NextResponse.json({ prompts: [], workflows: [] } satisfies MarketplaceListingsResponse, {
      status: 500,
    });
  }
}
