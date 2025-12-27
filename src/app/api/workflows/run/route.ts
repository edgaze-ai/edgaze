import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    // body is whatever you send from the builder (nodes, edges, etc.)
    // For now just echo it back in a nice structure.
    return NextResponse.json(
      {
        ok: true,
        message: "Workflow ran successfully (dummy backend).",
        receivedGraph: body ?? null,

        // shape the RunModal expects / can use
        output: {
          result: "Hello from /api/workflows/run",
          nodeCount: Array.isArray(body?.nodes) ? body.nodes.length : 0,
          edgeCount: Array.isArray(body?.edges) ? body.edges.length : 0,
        },
        logs: [
          {
            time: new Date().toISOString(),
            message: "Dummy run completed. Replace this with real execution.",
          },
        ],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Workflow run error:", err);
    return NextResponse.json(
      { ok: false, message: "Internal error in /api/workflows/run" },
      { status: 500 }
    );
  }
}
