import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Minimal token endpoint.
 * Replace the internals with your real logic if you need it.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
