import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const LIMIT = 15;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type TrendingItem = {
  id: string;
  type: "workflow" | "prompt";
  edgaze_code: string | null;
  title: string | null;
  description: string | null;
  prompt_text: string | null;
  thumbnail_url: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_handle: string | null;
  tags: string | null;
  monetisation_mode: string | null;
  is_paid: boolean | null;
  price_usd: number | null;
  view_count: number | null;
  like_count: number | null;
  created_at: string | null;
  published_at?: string | null;
};

export type TrendingThisWeekResponse = {
  topWorkflowsThisWeek: TrendingItem[];
  topPromptsThisWeek: TrendingItem[];
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - WEEK_MS).toISOString();

    // 1. Get run counts for last 7 days (success/error/canceled only)
    const { data: runRows } = await supabase
      .from("runs")
      .select("workflow_id, prompt_id, kind")
      .gte("started_at", since)
      .in("status", ["success", "error", "canceled"])
      .not("ended_at", "is", null);

    const workflowRunCounts = new Map<string, number>();
    const promptRunCounts = new Map<string, number>();
    for (const r of runRows ?? []) {
      const id = (r as { workflow_id?: string; prompt_id?: string }).workflow_id ?? (r as { prompt_id?: string }).prompt_id;
      if (!id) continue;
      if ((r as { kind?: string }).kind === "workflow") {
        workflowRunCounts.set(id, (workflowRunCounts.get(id) ?? 0) + 1);
      } else {
        promptRunCounts.set(id, (promptRunCounts.get(id) ?? 0) + 1);
      }
    }

    // 2. Fetch all public workflows and prompts with stats
    const baseSelectWorkflows = [
      "id", "owner_id", "type", "edgaze_code", "title", "description",
      "prompt_text", "thumbnail_url", "owner_name", "owner_handle", "tags",
      "monetisation_mode", "is_paid", "price_usd", "views_count", "likes_count",
      "created_at", "published_at",
    ].join(",");

    const baseSelectPrompts = [
      "id", "owner_id", "type", "edgaze_code", "title", "description",
      "prompt_text", "thumbnail_url", "owner_name", "owner_handle", "tags",
      "monetisation_mode", "is_paid", "price_usd", "views_count", "likes_count",
      "view_count", "like_count", "created_at",
    ].join(",");

    let workflowsData: Record<string, unknown>[] = [];
    const wRes = await supabase
      .from("workflows")
      .select(baseSelectWorkflows)
      .eq("is_published", true)
      .is("removed_at", null)
      .in("visibility", ["public", "unlisted"]);

    if (wRes.error) {
      const msg = String((wRes.error as { message?: string })?.message ?? "").toLowerCase();
      if (msg.includes("visibility") || msg.includes("column")) {
        const fallback = await supabase
          .from("workflows")
          .select(baseSelectWorkflows)
          .eq("is_published", true)
          .eq("is_public", true)
          .is("removed_at", null);
        workflowsData = (fallback.data ?? []) as unknown as Record<string, unknown>[];
      } else {
        console.error("[trending] Workflows fetch error:", wRes.error);
      }
    } else {
      workflowsData = (wRes.data ?? []) as unknown as Record<string, unknown>[];
    }

    const pRes = await supabase
      .from("prompts")
      .select(baseSelectPrompts)
      .in("type", ["prompt", "workflow"])
      .in("visibility", ["public", "unlisted"]);

    const promptsData = (pRes.data ?? []) as unknown as Record<string, unknown>[];
    if (pRes.error) {
      console.error("[trending] Prompts fetch error:", pRes.error);
    }

    function score(runs: number, views: number, likes: number): number {
      return runs * 3 + likes * 2 + views * 1;
    }

    // Filter to only prompts (type=prompt), workflows are type=workflow
    const promptOnly = promptsData.filter((p) => (p as { type?: string }).type !== "workflow");
    const workflowFromWorkflows = workflowsData.map((w: Record<string, unknown>) => ({
      ...w,
      type: "workflow",
    }));

    const scoredWorkflows = workflowFromWorkflows
      .map((w: Record<string, unknown>) => {
        const id = String(w.id ?? "");
        const runs = workflowRunCounts.get(id) ?? 0;
        const views = Number(w.views_count ?? 0);
        const likes = Number(w.likes_count ?? 0);
        return { w, s: score(runs, views, likes) };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, LIMIT);

    const scoredPrompts = promptOnly
      .map((p) => {
        const id = String(p.id ?? "");
        const runs = promptRunCounts.get(id) ?? 0;
        const views = Number(p.views_count ?? p.view_count ?? 0);
        const likes = Number(p.likes_count ?? p.like_count ?? 0);
        return { p, s: score(runs, views, likes) };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, LIMIT);

    const toItem = (row: Record<string, unknown>, type: "workflow" | "prompt"): TrendingItem => ({
      id: String(row.id ?? ""),
      type,
      edgaze_code: (row.edgaze_code as string) ?? null,
      title: (row.title as string) ?? null,
      description: (row.description as string) ?? null,
      prompt_text: (row.prompt_text as string) ?? null,
      thumbnail_url: (row.thumbnail_url as string) ?? null,
      owner_id: row.owner_id != null ? String(row.owner_id) : null,
      owner_name: (row.owner_name as string) ?? null,
      owner_handle: (row.owner_handle as string) ?? null,
      tags: (row.tags as string) ?? null,
      monetisation_mode: (row.monetisation_mode as string) ?? null,
      is_paid: (row.is_paid as boolean) ?? null,
      price_usd: row.price_usd != null ? Number(row.price_usd) : null,
      view_count:
        row.views_count != null ? Number(row.views_count) : row.view_count != null ? Number(row.view_count) : null,
      like_count:
        row.likes_count != null ? Number(row.likes_count) : row.like_count != null ? Number(row.like_count) : null,
      created_at: (row.created_at as string) ?? (row.published_at as string) ?? null,
      published_at: (row.published_at as string) ?? null,
    });

    const topWorkflowsThisWeek = scoredWorkflows.map(({ w }) => toItem(w as Record<string, unknown>, "workflow"));
    const topPromptsThisWeek = scoredPrompts.map(({ p }) => toItem(p as Record<string, unknown>, "prompt"));

    return NextResponse.json({
      topWorkflowsThisWeek,
      topPromptsThisWeek,
    } satisfies TrendingThisWeekResponse);
  } catch (err) {
    console.error("[trending] Error:", err);
    return NextResponse.json(
      { topWorkflowsThisWeek: [], topPromptsThisWeek: [] } satisfies TrendingThisWeekResponse,
      { status: 500 }
    );
  }
}
