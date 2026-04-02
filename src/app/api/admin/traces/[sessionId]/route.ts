import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@lib/auth/server";
import { isAdmin } from "@lib/supabase/executions";
import { buildWorkflowRunTraceBundle } from "src/server/trace-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Not authenticated" }, { status: 401 });
    }
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { sessionId } = await params;
    const bundle = await buildWorkflowRunTraceBundle(sessionId);
    return NextResponse.json(bundle);
  } catch (error) {
    const status = error instanceof Error && error.message === "Trace bundle not found" ? 404 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "Trace bundle not found"
            ? "Trace bundle not found"
            : error instanceof Error
              ? error.message
              : "Failed to load trace detail.",
      },
      { status },
    );
  }
}
