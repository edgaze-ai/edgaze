import { NextResponse } from "next/server";
import { runFlow } from "src/server/flow/engine";
import type { GraphPayload } from "src/server/flow/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GraphPayload;
    const result = await runFlow(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, message: err?.message ?? "Flow run failed" },
      { status: 500 }
    );
  }
}
