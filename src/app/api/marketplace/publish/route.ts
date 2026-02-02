// src/app/api/marketplace/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserAndClient } from "../../flow/_auth";

type Visibility = "public" | "unlisted" | "private";
type MonetisationMode = "free" | "paywall" | "subscription" | "paywall+subscription";

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
  monetisationMode: MonetisationMode | "both"; // accept legacy "both"
  priceUsd: string;
  sampleOutput: string;
  requestedCode?: string | null;
};

type PublishBody = {
  type: "prompt" | "workflow";
  promptText: string;
  placeholders: PlaceholderDef[];
  meta: PublishMeta;
};

function slugifyHandle(raw: string): string {
  return (
    raw
      ?.toLowerCase()
      .trim()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 24) || "user"
  );
}

const WORDS_A = ["neon", "turbo", "rapid", "cosmic", "prime", "flux", "delta", "quantum", "shadow", "nova"] as const;
const WORDS_B = ["draft", "script", "hooks", "titles", "ideas", "flow", "engine", "prompt", "builder", "wizard"] as const;

function normaliseCode(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function isCodeTaken(supabase: any, code: string): Promise<boolean> {
  const { data, error } = await supabase.from("prompts").select("id").eq("edgaze_code", code).limit(1);
  if (error) {
    console.error("Code check failed", error);
    return true; // fail-safe
  }
  return (data?.length ?? 0) > 0;
}

/**
 * IMPORTANT:
 * Your TypeScript build is failing because a generic `pick<T>` must return `T`,
 * but indexing an array can be `T | undefined`.
 * Fix: make a string-only picker with a guaranteed fallback.
 */
function pickFrom<const T extends readonly string[]>(arr: T): T[number] {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? arr[0] ?? "edge";
}

async function generateEdgazeCode(supabase: any, title: string): Promise<string> {
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  const base = titleWords.slice(0, 2); // string[]

  for (let attempt = 0; attempt < 12; attempt++) {
    let candidate: string;

    if (attempt < 6 && base.length > 0) {
      candidate = normaliseCode(base[attempt % base.length] ?? "");
    } else {
      const a = pickFrom(WORDS_A);
      const b = pickFrom(WORDS_B);
      const suffix = attempt >= 8 ? Math.floor(Math.random() * 90 + 10).toString() : "";
      candidate = normaliseCode(`${a}${b}${suffix}`);
    }

    if (!candidate) continue;
    if (!(await isCodeTaken(supabase, candidate))) return candidate;
  }

  return normaliseCode(`edge-${Math.random().toString(36).slice(2, 8)}`);
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUserAndClient(req);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = user.id;

    const body = (await req.json()) as PublishBody;
    const { type, promptText, placeholders, meta } = body;

    if (!promptText?.trim()) {
      return NextResponse.json({ error: "Prompt text is required" }, { status: 400 });
    }
    if (!meta?.name?.trim()) {
      return NextResponse.json({ error: "Prompt name is required" }, { status: 400 });
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("full_name,handle,plan,email,email_verified")
      .eq("id", userId)
      .maybeSingle();

    const ownerName = (profileRow as any)?.full_name ?? (user.user_metadata as any)?.full_name ?? "";
    const ownerHandle = slugifyHandle((profileRow as any)?.handle ?? user.email?.split("@")[0] ?? "user");

    const userPlan = (((profileRow as any)?.plan ?? "Free") as "Free" | "Pro" | "Team");

    const monetisationMode: MonetisationMode =
      meta.monetisationMode === "both"
        ? "paywall+subscription"
        : (meta.monetisationMode as MonetisationMode);

    // Determine Edgaze code
    let code: string | null = null;

    const requestedRaw = meta.requestedCode;
    if (requestedRaw && (userPlan === "Pro" || userPlan === "Team")) {
      const normalised = normaliseCode(requestedRaw);
      if (!normalised) {
        return NextResponse.json({ error: "Custom code is invalid" }, { status: 400 });
      }
      if (await isCodeTaken(supabase, normalised)) {
        return NextResponse.json({ error: "That Edgaze code is already in use" }, { status: 409 });
      }
      code = normalised;
    }

    if (!code) {
      code = await generateEdgazeCode(supabase, meta.name);
    }

    const priceNumber = monetisationMode === "free" ? 0 : meta.priceUsd ? Number(meta.priceUsd) : 0;

    const isPaid =
      monetisationMode === "paywall" ||
      monetisationMode === "subscription" ||
      monetisationMode === "paywall+subscription";

    const { data, error } = await supabase
      .from("prompts")
      .insert({
        type, // "prompt" | "workflow"
        edgaze_code: code,
        owner_id: userId,
        owner_name: ownerName,
        owner_handle: ownerHandle,
        title: meta.name.trim(),
        description: (meta.description ?? "").trim(),
        thumbnail_url: meta.thumbnailUrl || null,
        tags: meta.tags || null,
        visibility: meta.visibility,
        monetisation_mode: monetisationMode,
        is_paid: isPaid,
        price_usd: priceNumber || null,
        meta: {
          sample_output: meta.sampleOutput ?? "",
          placeholder_count: placeholders?.length ?? 0,
        },
        prompt_text: promptText,
        placeholders: placeholders ?? [],
      })
      .select("id,edgaze_code,owner_handle")
      .single();

    if (error) {
      console.error("Failed to publish prompt", error);
      return NextResponse.json({ error: "Failed to publish prompt" }, { status: 500 });
    }

    const urlPath = `/@${ownerHandle}/${data.edgaze_code}`;

    return NextResponse.json(
      { id: data.id, edgazeCode: data.edgaze_code, ownerHandle, urlPath },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected publish error", err);
    return NextResponse.json({ error: "Unexpected error while publishing" }, { status: 500 });
  }
}
