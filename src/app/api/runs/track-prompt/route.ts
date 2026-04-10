/**
 * Track a prompt run for analytics and public runs_count.
 * Call when the user actually runs (e.g. opens provider / copies filled prompt)—not on modal open alone.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "@lib/auth/server";
import { createRun, updateRun } from "@lib/supabase/runs";
import { createSupabaseAdminClient } from "@lib/supabase/admin";
import { incrementMarketplaceListingRunCount } from "@lib/metrics/publicRunCount";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      promptId?: string;
      provider?: string;
      deviceFingerprint?: string;
    };
    const { promptId, provider } = body;

    if (!promptId || typeof promptId !== "string") {
      return NextResponse.json({ error: "promptId is required" }, { status: 400 });
    }

    const { user } = await getUserAndClient(req);
    const runnerUserId = user?.id ?? null;
    const isUuidRunner = runnerUserId ? /^[0-9a-f-]{36}$/i.test(runnerUserId) : false;

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
      runnerUserId: isUuidRunner ? runnerUserId : null,
      creatorUserId,
      metadata,
    });

    await updateRun(run.id, {
      status: "success",
      endedAt: new Date().toISOString(),
      durationMs: 0,
      metadata,
    });

    await incrementMarketplaceListingRunCount({
      listingType: "prompt",
      listingId: promptId,
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (e: unknown) {
    console.error("[track-prompt] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 },
    );
  }
}
