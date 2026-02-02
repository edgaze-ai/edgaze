import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../flow/_auth";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const MAX_TEXT_LENGTH = 50_000; // ~50KB to prevent abuse

/** tiny helper with timeout */
function withTimeout<T>(p: Promise<T>, ms = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json().catch(() => ({ text: "" }));
    if (!text || typeof text !== "string") {
      return NextResponse.json({ summary: "No activity to summarize." }, { status: 200 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    // Try Ollama first (best-effort)
    try {
      const r = await withTimeout(fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt:
            "Summarize the following workflow run for a non-technical user in 2 sentences. Keep it plain and helpful:\n\n" +
            text,
          stream: false,
        }),
      }), 3500);

      if (r.ok) {
        const j = await r.json().catch(() => null as any);
        if (j?.response) {
          return NextResponse.json({ summary: j.response }, { status: 200 });
        }
      }
    } catch {
      /* fall through to fallback */
    }

    // Fallback: quick human-friendly summary
    const lines = text.split(/\n+/).filter(Boolean);
    const first = lines.find((l) => /start/i.test(l)) || lines[0] || "The workflow started.";
    const last = lines.reverse().find((l) => /(finish|done|output|success)/i.test(l)) || "The workflow finished.";
    const summary = `${first.replace(/\[\d+:\d+(:\d+)?\s*(AM|PM)?\]\s*/i, "")} ${last}`;
    return NextResponse.json({ summary }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ summary: "Couldn’t generate a summary." }, { status: 200 });
  }
}
