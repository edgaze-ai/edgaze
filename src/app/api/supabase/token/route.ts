import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Deprecated: no-op token endpoint removed for security.
 * Do not use for token/session exchange.
 */
export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
