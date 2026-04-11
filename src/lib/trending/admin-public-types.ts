/**
 * Client-safe types for admin trending UI (no server-only imports).
 */
export type TrendingAdminRow = {
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
  owner_avatar_url?: string | null;
  owner_is_verified_creator?: boolean | null;
  owner_is_verified?: boolean;
  weekly_runs: number;
  thumbnail_auto_generated: boolean | null;
  week_views_for_rank: number;
  exclude_from_trending: boolean;
};
