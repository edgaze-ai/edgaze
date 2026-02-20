import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkSimpleIpRateLimit } from "@lib/rate-limiting/simple-ip";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  try {
    const { allowed } = checkSimpleIpRateLimit(req);
    if (!allowed) {
      return json(429, { available: false, reason: "rate_limit" });
    }

    const url = new URL(req.url);
    const handleRaw = (url.searchParams.get("handle") || "").trim().toLowerCase();
    let excludeUserId = url.searchParams.get("exclude_user_id")?.trim() || null;

    if (!handleRaw) return json(400, { available: false, reason: "missing_handle" });

    // basic rules: 3-24, a-z 0-9 _
    if (!/^[a-z0-9_]{3,24}$/.test(handleRaw)) {
      return json(200, { available: false, reason: "invalid" });
    }

    // Validate exclude_user_id is a valid UUID (security: prevent injection/abuse)
    if (excludeUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(excludeUserId)) {
      excludeUserId = null;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceKey) {
      return json(500, { available: false, reason: "server_misconfig" });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let query = admin.from("profiles").select("id").eq("handle", handleRaw).limit(2);
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query;

    if (error) return json(500, { available: false, reason: "db_error" });

    // Taken if any row exists (when excluding, only "other" users count as taken)
    const taken = (data?.length ?? 0) > 0;
    return json(200, { available: !taken });
  } catch {
    return json(500, { available: false, reason: "unknown" });
  }
}
