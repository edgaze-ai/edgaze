import { NextResponse } from "next/server";

import { pruneExpiredWorkflowTraceStorage } from "src/server/trace-storage";
import { verifyCronSecret } from "@/lib/auth/verify-cron-secret";

export const dynamic = "force-dynamic";
/** Trace prune may list/delete many Storage objects and run SQL cleanup. */
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pruneExpiredWorkflowTraceStorage({ dryRun: false });
    if (
      result.expiredSessionCount > 0 ||
      (result.sqlPrune &&
        (result.sqlPrune.deleted_entries > 0 ||
          result.sqlPrune.deleted_sessions > 0 ||
          result.sqlPrune.deleted_artifacts > 0))
    ) {
      console.warn("[CRON] prune-trace-storage:", JSON.stringify(result));
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[CRON] prune-trace-storage error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prune failed" },
      { status: 500 },
    );
  }
}
