import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const detailUrl = new URL(`/api/admin/traces/${sessionId}`, req.url);
  const response = await fetch(detailUrl.toString(), {
    method: "GET",
    headers: { Authorization: req.headers.get("authorization") ?? "" },
    cache: "no-store",
  });

  const payload = await response.text();
  if (!response.ok) {
    return new NextResponse(payload, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="trace-${sessionId}.json"`,
    },
  });
}
