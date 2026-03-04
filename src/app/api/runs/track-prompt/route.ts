/**
 * Track a prompt run for analytics.
 * Prompts are always accessible after purchase; we count each run.
 */
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { createRun, updateRun } from "@lib/supabase/runs";
import { createSupabaseAdminClient } from "@lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { promptId?: string; provider?: string };
    const { promptId, provider } = body;

    if (!promptId || typeof promptId !== "string") {
      return NextResponse.json({ error: "promptId is required" }, { status: 400 });
    }

    const { user } = await getUserFromRequest(req);
    const runnerUserId = user?.id ?? null;

    const supabase = createSupabaseAdminClient();
    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .select("id, owner_id")
      .eq("id", promptId)
      .maybeSingle();

    if (promptError || !prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const creatorUserId = (prompt as { owner_id?: string }).owner_id ?? null;

    const metadata = { provider: provider ?? null };
    const run = await createRun({
      kind: "prompt",
      promptId,
      runnerUserId,
      creatorUserId,
      metadata,
    });

    await updateRun(run.id, {
      status: "success",
      endedAt: new Date().toISOString(),
      durationMs: 0,
      metadata,
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (e: unknown) {
    console.error("[track-prompt] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
