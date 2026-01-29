// src/app/api/apply/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

type Q1 =
  | "I’ve tried them a few times"
  | "I use them occasionally (weekly)"
  | "I rely on them daily for work or study"
  | "I use them heavily across multiple workflows every day";

type Q2 =
  | "Casual use (chatting, homework help, basic questions)"
  | "Structured prompts for real tasks (writing, coding, research, content)"
  | "Connected prompts into repeatable workflows or systems"
  | "Built, shared, or sold AI setups, prompt packs, or tools";

type Q3 =
  | "Run higher-quality prompts and workflows made by others"
  | "Turn my own prompts into something reusable and organized"
  | "Build, publish, and iterate on workflows or prompt packs"
  | "Explore what advanced AI users are building"
  | "Eventually monetize my AI setups";

type Q4 = "Yes, I’m happy to give feedback" | "Maybe, if I have time" | "Probably not";

type Q6 =
  | "No, never"
  | "Yes, informally (friends, Discord, WhatsApp, Notion)"
  | "Yes, publicly (Twitter, GitHub, Gumroad, etc.)";

type Tier = "A" | "B" | "C";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf
      .split(",")
      .map((s) => s.trim())
      .find(Boolean);
    return first ?? "unknown";
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isEmail(s: string) {
  return /^\S+@\S+\.\S+$/.test(s);
}

function clampStr(s: any, max: number) {
  return String(s ?? "").trim().slice(0, max);
}

function scoreAndTier(args: { q1: Q1; q2: Q2; q3: Q3; q4: Q4; q5: string }) {
  const notes: string[] = [];
  let score = 0;

  const q1Score =
    args.q1 === "I’ve tried them a few times"
      ? 0
      : args.q1 === "I use them occasionally (weekly)"
      ? 1
      : args.q1 === "I rely on them daily for work or study"
      ? 2
      : 3;
  score += q1Score;

  const q2Score =
    args.q2 === "Casual use (chatting, homework help, basic questions)"
      ? 0
      : args.q2 === "Structured prompts for real tasks (writing, coding, research, content)"
      ? 2
      : args.q2 === "Connected prompts into repeatable workflows or systems"
      ? 3
      : 4;
  score += q2Score;

  const q3Score =
    args.q3 === "Build, publish, and iterate on workflows or prompt packs"
      ? 2
      : args.q3 === "Turn my own prompts into something reusable and organized"
      ? 2
      : args.q3 === "Run higher-quality prompts and workflows made by others"
      ? 1
      : 0;
  score += q3Score;

  score += args.q4 === "Yes, I’m happy to give feedback" ? 1 : 0;

  const q5 = args.q5.trim();
  const lower = q5.toLowerCase();

  // keep numeric quality for scoring
  let q5Quality: -2 | 0 | 1 | 2 = 0;

  const touristSignals = [
    "explore ai",
    "learn more",
    "check it out",
    "see what it is",
    "try edgaze",
    "look around",
    "explore",
  ];
  const actionSignals = [
    "publish",
    "build",
    "workflow",
    "pack",
    "remix",
    "iterate",
    "turn",
    "convert",
    "speed up",
    "automate",
    "system",
  ];

  const hasAction = actionSignals.some((s) => lower.includes(s));
  const isTourist = touristSignals.some((s) => lower.includes(s));

  if (!q5 || q5.length < 10) q5Quality = -2;
  else if (isTourist && !hasAction) q5Quality = -2;
  else if (
    hasAction &&
    (lower.includes(" to ") ||
      lower.includes(" into ") ||
      lower.includes(" so i can") ||
      lower.includes(" so that"))
  )
    q5Quality = 2;
  else if (hasAction) q5Quality = 1;
  else q5Quality = 0;

  score += q5Quality;

  // boolean for safe comparisons (avoids TS union overlap errors)
  const q5Bad = q5Quality === -2;

  const q2AtMostStructured =
    args.q2 === "Casual use (chatting, homework help, basic questions)" ||
    args.q2 === "Structured prompts for real tasks (writing, coding, research, content)";
  if (args.q3 === "Eventually monetize my AI setups" && q2AtMostStructured) {
    notes.push("Guardrail: Monetization intent without builder proof → Tier C forced.");
    return { score, tier: "C" as Tier, q5_quality: q5Quality, notes };
  }

  const q1AtLeastDaily =
    args.q1 === "I rely on them daily for work or study" ||
    args.q1 === "I use them heavily across multiple workflows every day";

  const q1AtLeastWeekly = args.q1 !== "I’ve tried them a few times";

  const q2AtLeastWorkflows =
    args.q2 === "Connected prompts into repeatable workflows or systems" ||
    args.q2 === "Built, shared, or sold AI setups, prompt packs, or tools";

  if (
    score <= 4 ||
    args.q1 === "I’ve tried them a few times" ||
    args.q2 === "Casual use (chatting, homework help, basic questions)" ||
    q5Bad ||
    args.q4 === "Probably not"
  ) {
    return { score, tier: "C" as Tier, q5_quality: q5Quality, notes };
  }

  if (
    score >= 8 &&
    q1AtLeastDaily &&
    args.q4 === "Yes, I’m happy to give feedback" &&
    q2AtLeastWorkflows &&
    !q5Bad
  ) {
    return { score, tier: "A" as Tier, q5_quality: q5Quality, notes };
  }

  if (
    score >= 5 &&
    score <= 7 &&
    (args.q4 === "Yes, I’m happy to give feedback" || args.q4 === "Maybe, if I have time") &&
    q1AtLeastWeekly
  ) {
    return { score, tier: "B" as Tier, q5_quality: q5Quality, notes };
  }

  return { score, tier: "C" as Tier, q5_quality: q5Quality, notes };
}

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  // Require proof cookie created by /api/turnstile/verify
  const store = await cookies();
  const proof = store.get("edgaze_apply_captcha")?.value;
  if (!proof) return NextResponse.json({ error: "Captcha required." }, { status: 400 });

  const ip = getIp(req);
  const ua = req.headers.get("user-agent") || "";
  const ip_hash = sha256(ip + "|" + (process.env.RATE_LIMIT_SALT || "edgaze"));

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const access_token = clampStr(body.access_token, 5000);
  if (!access_token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Validate Supabase user using the access token (prevents spoofing user_id)
  const supabaseAuth = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(access_token);
  if (userErr || !userData?.user?.id) return NextResponse.json({ error: "Auth check failed." }, { status: 401 });
  const auth_user_id = userData.user.id;

  // Personal details (FULL NAME FIX: fallback to auth metadata for Google OAuth)
  const submittedName = clampStr(body.full_name, 120);

  const authNameRaw =
    (userData.user.user_metadata?.full_name as string | undefined) ||
    (userData.user.user_metadata?.name as string | undefined) ||
    "";

  const emailFromAuth = (userData.user.email || "").toLowerCase();
  const fallbackFromEmail = emailFromAuth ? emailFromAuth.split("@")[0] : "";

  const full_name = clampStr(submittedName || authNameRaw || fallbackFromEmail, 120);

  const email = clampStr(body.email, 180).toLowerCase() || emailFromAuth;
  const phone_country_code = clampStr(body.phone_country_code, 8);
  const phone_number = clampStr(body.phone_number, 32);
  const company = clampStr(body.company, 160) || null;
  const occupation = clampStr(body.occupation, 160) || null;

  const feedback_consent = body.feedback_consent === true;

  // Answers (all required)
  const q1 = body.q1 as Q1;
  const q2 = body.q2 as Q2;
  const q3 = body.q3 as Q3;
  const q4 = body.q4 as Q4;
  const q5 = clampStr(body.q5, 140);
  const q6 = body.q6 as Q6;

  if (!full_name || full_name.length < 2) return NextResponse.json({ error: "Name required." }, { status: 400 });
  if (!isEmail(email)) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  // Phone is optional; store whatever was provided (can be empty)
  if (!feedback_consent) return NextResponse.json({ error: "Feedback consent required." }, { status: 400 });

  // Hard rule: must be Yes
  if (q4 !== "Yes, I’m happy to give feedback") {
    return NextResponse.json({ error: "You must commit to feedback during beta." }, { status: 400 });
  }

  if (!q5 || q5.trim().length < 10 || q5.trim().length > 140) {
    return NextResponse.json({ error: "One sentence, 10–140 chars." }, { status: 400 });
  }
  if (!q6) return NextResponse.json({ error: "Answer the sharing question." }, { status: 400 });

  // Rate limiting
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: ipCount }, { count: emailCount }, { count: userCount }] = await Promise.all([
    supabase
      .from("closed_beta_applications")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash)
      .gte("created_at", oneHourAgo),
    supabase
      .from("closed_beta_applications")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneDayAgo),
    supabase
      .from("closed_beta_applications")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", auth_user_id)
      .gte("created_at", oneDayAgo),
  ]);

  if ((ipCount ?? 0) >= 5) return NextResponse.json({ error: "Too many attempts. Try later." }, { status: 429 });
  if ((emailCount ?? 0) >= 1) return NextResponse.json({ error: "This email applied recently." }, { status: 429 });
  if ((userCount ?? 0) >= 1) return NextResponse.json({ error: "You already applied recently." }, { status: 429 });

  const scored = scoreAndTier({ q1, q2, q3, q4, q5 });
  const phone_full = [phone_country_code, phone_number].filter(Boolean).join("").replace(/\s/g, "") || "";

  const insertPayload = {
    auth_user_id,

    full_name,
    email,
    phone_country_code,
    phone_number,
    phone_full,
    company,
    occupation,

    feedback_consent: true,

    q1_ai_usage_frequency: q1,
    q2_ai_done: q2,
    q3_why_edgaze: q3,
    q4_feedback_commitment: q4,
    q5_one_liner: q5.trim(),
    q6_prior_sharing: q6,

    score_total: scored.score,
    q5_quality: scored.q5_quality,
    tier: scored.tier,
    scoring_notes: scored.notes.length ? scored.notes : null,

    ip_hash,
    user_agent: ua,
    source: "apply_v4_cookie_captcha",
  };

  const { data, error } = await supabase
    .from("closed_beta_applications")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Single-use proof: clear cookie only after successful submit
  const res = NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  res.cookies.set("edgaze_apply_captcha", "", { path: "/", maxAge: 0 });
  return res;
}
