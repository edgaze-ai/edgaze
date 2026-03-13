import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "src/lib/supabase/admin";

export type AboutStatsResponse = {
  promptsPublished: number;
  workflowsPublished: number;
  creators: number;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // Prompts published (type=prompt, visibility public/unlisted)
    const promptsRes = await supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("type", "prompt")
      .in("visibility", ["public", "unlisted"]);

    let promptsPublished = promptsRes.count ?? 0;
    if (promptsRes.error) {
      const msg = String(promptsRes.error.message ?? "").toLowerCase();
      if (msg.includes("visibility") || msg.includes("column")) {
        const fallback = await supabase
          .from("prompts")
          .select("id", { count: "exact", head: true })
          .eq("type", "prompt")
          .eq("is_public", true);
        promptsPublished = fallback.count ?? 0;
      }
    }

    // Workflows published (is_published, visibility public/unlisted or is_public)
    let workflowsRes = await supabase
      .from("workflows")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .in("visibility", ["public", "unlisted"])
      .is("removed_at", null);

    let workflowsPublished = workflowsRes.count ?? 0;
    if (workflowsRes.error) {
      const msg = String(workflowsRes.error.message ?? "").toLowerCase();
      if (msg.includes("visibility") || msg.includes("column")) {
        const fallback = await supabase
          .from("workflows")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true)
          .eq("is_public", true)
          .is("removed_at", null);
        workflowsPublished = fallback.count ?? 0;
      }
    }

    // Creators = total profiles (signups)
    const profilesRes = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    const creators = profilesRes.count ?? 0;

    return NextResponse.json({
      promptsPublished,
      workflowsPublished,
      creators,
    } satisfies AboutStatsResponse);
  } catch (err) {
    console.error("[about/stats]", err);
    return NextResponse.json(
      { promptsPublished: 0, workflowsPublished: 0, creators: 0 },
      { status: 500 }
    );
  }
}
