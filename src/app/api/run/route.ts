import { NextResponse } from "next/server";

/**
 * Deprecated: use /api/flow/run for workflow execution.
 * Security: no unauthenticated workflow execution.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Gone", message: "Use /api/flow/run for workflow execution." },
    { status: 410 }
  );
}
