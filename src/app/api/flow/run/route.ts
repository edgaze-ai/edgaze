import { NextResponse } from "next/server";

// Echo runner – replace with real execution.
// Prevents 404s and lets the modal show "Finished".
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({ nodes: [], edges: [] }));
    return NextResponse.json({
      ok: true,
      received: {
        nodes: Array.isArray(body?.nodes) ? body.nodes.length : 0,
        edges: Array.isArray(body?.edges) ? body.edges.length : 0,
      },
      message: "Run completed (stub). Wire your real runner here.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
