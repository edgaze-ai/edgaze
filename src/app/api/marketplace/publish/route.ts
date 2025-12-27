// src/app/api/marketplace/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "src/app/api/auth/[...nextauth]/route"; // adjust if your path differs
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "both";

type PlaceholderDef = {
  name: string;
  question: string;
};

type PublishMeta = {
  name: string;
  description: string;
  thumbnailUrl: string;
  tags: string;
  visibility: Visibility;
  monetisationMode: MonetisationMode;
  priceUsd: string;
  sampleOutput: string;
  requestedCode?: string | null; // optional custom code for Pro
};

type PublishBody = {
  type: "prompt" | "workflow";
  promptText: string;
  placeholders: PlaceholderDef[];
  meta: PublishMeta;
};

function slugifyHandle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";
}

// simple human-ish word list for codes
const WORDS_A = [
  "neon",
  "turbo",
  "rapid",
  "cosmic",
  "prime",
  "flux",
  "delta",
  "quantum",
  "shadow",
  "nova",
];
const WORDS_B = [
  "draft",
  "script",
  "hooks",
  "titles",
  "ideas",
  "flow",
  "engine",
  "prompt",
  "builder",
  "wizard",
];

// normalise any requested code
function normaliseCode(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function isCodeTaken(code: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("prompts")
    .select("id")
    .eq("edgaze_code", code)
    .limit(1);

  if (error) {
    console.error("Code check failed", error);
    // fail safe: assume taken so we don't reuse
    return true;
  }
  return (data?.length ?? 0) > 0;
}

async function generateEdgazeCode(
  title: string,
  ownerHandle: string
): Promise<string> {
  const baseWords: string[] = [];

  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (titleWords[0]) baseWords.push(titleWords[0]);
  if (titleWords[1]) baseWords.push(titleWords[1]);

  // Try a few combinations of human-ish codes
  for (let attempt = 0; attempt < 12; attempt++) {
    let candidate: string;

    if (attempt < 6 && baseWords.length > 0) {
      const w = baseWords[attempt % baseWords.length];
      candidate = normaliseCode(w);
    } else {
      const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
      const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
      const suffix =
        attempt >= 8 ? Math.floor(Math.random() * 90 + 10).toString() : "";
      candidate = normaliseCode(a + b + suffix);
    }

    if (!candidate) continue;
    if (!(await isCodeTaken(candidate))) return candidate;
  }

  // Last resort: short random
  const fallback = `edge-${Math.random().toString(36).slice(2, 8)}`;
  return normaliseCode(fallback);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as PublishBody;
    const { type, promptText, placeholders, meta } = body;

    if (!promptText?.trim()) {
      return NextResponse.json(
        { error: "Prompt text is required" },
        { status: 400 }
      );
    }

    if (!meta?.name?.trim()) {
      return NextResponse.json(
        { error: "Prompt name is required" },
        { status: 400 }
      );
    }

    // derive user identity
    const userId = (session.user as any).id ?? session.user.email;
    const ownerName = session.user.name ?? "";
    const ownerHandleRaw =
      (session.user as any).handle ??
      (session.user.email
        ? session.user.email.split("@")[0]
        : ownerName || "user");
    const ownerHandle = slugifyHandle(ownerHandleRaw);

    const userPlan = ((session.user as any).plan ??
      "Free") as "Free" | "Pro" | "Team";

    if (!userId) {
      return NextResponse.json(
        { error: "Could not determine user identity" },
        { status: 400 }
      );
    }

    // Determine Edgaze code
    let code: string | null = null;

    const requestedRaw = meta.requestedCode;
    if (requestedRaw && (userPlan === "Pro" || userPlan === "Team")) {
      const normalised = normaliseCode(requestedRaw);
      if (!normalised) {
        return NextResponse.json(
          { error: "Custom code is invalid" },
          { status: 400 }
        );
      }
      if (await isCodeTaken(normalised)) {
        return NextResponse.json(
          { error: "That Edgaze code is already in use" },
          { status: 409 }
        );
      }
      code = normalised;
    }

    if (!code) {
      code = await generateEdgazeCode(meta.name, ownerHandle);
    }

    const priceNumber =
      meta.monetisationMode === "free"
        ? 0
        : meta.priceUsd
        ? Number(meta.priceUsd)
        : 0;

    const isPaid =
      meta.monetisationMode === "paywall" ||
      meta.monetisationMode === "subscription" ||
      meta.monetisationMode === "both";

    const { data, error } = await supabaseAdmin
      .from("prompts")
      .insert({
        type, // "prompt" | "workflow"
        edgaze_code: code,
        owner_id: userId,
        owner_name: ownerName,
        owner_handle: ownerHandle,
        title: meta.name.trim(),
        description: meta.description.trim(),
        thumbnail_url: meta.thumbnailUrl || null,
        tags: meta.tags || null,
        visibility: meta.visibility,
        monetisation_mode: meta.monetisationMode,
        is_paid: isPaid,
        price_usd: priceNumber || null,
        meta: {
          sample_output: meta.sampleOutput ?? "",
          placeholder_count: placeholders.length,
        },
        prompt_text: promptText,
        placeholders,
      })
      .select("id,edgaze_code,owner_handle")
      .single();

    if (error) {
      console.error("Failed to publish prompt", error);
      return NextResponse.json(
        { error: "Failed to publish prompt" },
        { status: 500 }
      );
    }

    const urlPath = `/@${ownerHandle}/${data.edgaze_code}`;

    return NextResponse.json(
      {
        id: data.id,
        edgazeCode: data.edgaze_code,
        ownerHandle,
        urlPath,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected publish error", err);
    return NextResponse.json(
      { error: "Unexpected error while publishing" },
      { status: 500 }
    );
  }
}