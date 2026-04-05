import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { buildWorkflowRunTraceBundle } from "src/server/trace-admin";
import {
  uploadWorkflowTraceBundleJson,
  upsertWorkflowRunTraceBundleRef,
} from "src/server/trace-storage";

export async function GET(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { sessionId: workflowRunId } = await context.params;

    // Always merge Storage parts + DB + workflow_run_events fresh. Serving cached bundle.json
    // caused permanent data loss when the first export ran before the run finished flushing.
    const bundle = await buildWorkflowRunTraceBundle(workflowRunId);
    const payload = `${JSON.stringify(bundle, null, 2)}\n`;
    try {
      const compact = JSON.stringify(bundle);
      const { path, bytes } = await uploadWorkflowTraceBundleJson({
        workflowRunId,
        jsonCompact: compact,
      });
      await upsertWorkflowRunTraceBundleRef({
        workflowRunId,
        bundleStoragePath: path,
        bundleBytes: bytes,
      });
    } catch (cacheErr) {
      if (!(cacheErr instanceof Error) || cacheErr.message !== "BUNDLE_TOO_LARGE") {
        console.warn("[trace download] bundle cache skipped:", cacheErr);
      }
    }

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="trace-${workflowRunId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "Trace bundle not found" ? 404 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "Trace bundle not found"
            ? "Trace bundle not found"
            : error instanceof Error
              ? error.message
              : "Failed to download trace bundle.",
      },
      { status },
    );
  }
}
