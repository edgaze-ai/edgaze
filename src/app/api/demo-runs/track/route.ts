import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Anonymous workflow demos are consumed only by /api/flow/run.",
    },
    { status: 410 },
  );
}
