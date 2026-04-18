import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import {
  computeTrendingThisWeek,
  type TrendingItem,
  type TrendingThisWeekResponse,
} from "../../../../lib/trending/compute-this-week";

/** Revalidate trending cache every 5 minutes so top workflows/prompts stay fresh */
const REVALIDATE_SECONDS = 300;

export type { TrendingItem, TrendingThisWeekResponse };

const getCachedTrending = unstable_cache(computeTrendingThisWeek, ["trending-this-week-cached"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["trending-this-week"],
});

async function getTrendingPayload(): Promise<TrendingThisWeekResponse> {
  try {
    return await getCachedTrending();
  } catch (err) {
    // Corrupt/empty cache entries (e.g. interrupted dev writes) can throw during deserialize.
    console.error("[trending] cache read failed, computing fresh:", err);
    return computeTrendingThisWeek();
  }
}

export async function GET() {
  try {
    const data = await getTrendingPayload();
    const headers = {
      "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=60`,
    };
    return NextResponse.json(data satisfies TrendingThisWeekResponse, { headers });
  } catch (err) {
    console.error("[trending] Error:", err);
    return NextResponse.json(
      { topWorkflowsThisWeek: [], topPromptsThisWeek: [] } satisfies TrendingThisWeekResponse,
      { status: 500 },
    );
  }
}
