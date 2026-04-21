import { NextResponse } from "next/server";

const PAYLOADS = {
  "launch-brief": {
    style: {
      mood: "dark premium",
      palette: ["#12131a", "#6d5dfc", "#f36db6", "#06080D"],
      spacing: "calm and spacious",
    },
    sections: [
      "hero with one clear promise",
      "proof strip with operational value",
      "metric cards with believable traction",
      "preview panel showing product page quality",
      "creator CTA and marketplace CTA",
    ],
    constraints: [
      "short headline",
      "credible metrics",
      "no abstract AI fluff",
      "one primary CTA and one supporting CTA",
    ],
  },
  "market-signal": {
    signals: [
      "Creators packaging prompts already have demand, but buyers hesitate when delivery is messy.",
      "Short-form distribution performs best when the workflow outcome is visible before the explanation.",
      "Clean product pages outperform screenshot threads because buyers can understand, trust, and act faster.",
    ],
    buyer_objections: [
      "I do not know what I get after purchase.",
      "The workflow looks hard to use.",
      "This feels like another dead prompt pack.",
    ],
    recommendation: {
      message: "Lead with the runnable outcome, then show the clean page and one-link sharing.",
      channels: ["X", "LinkedIn", "creator communities"],
    },
  },
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workflow = searchParams.get("workflow") || "";
  const payload = PAYLOADS[workflow as keyof typeof PAYLOADS];

  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Unknown homepage demo workflow." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    workflow,
    payload,
  });
}
