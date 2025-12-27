import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "bootstrap-profile deprecated" },
    { status: 410 }
  );
}
