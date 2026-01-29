import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type AuthResult =
  | { user: User; error: null }
  | { user: null; error: string };

/**
 * Authenticate the request using the Bearer token only.
 * Use this in run-related API routes; do not rely on cookies unless
 * Supabase SSR cookie syncing is fully wired (middleware + cookie getters/setters).
 * Client must send: Authorization: Bearer <accessToken>
 */
export async function getUserFromRequest(req: NextRequest | Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, error: "Missing Authorization token" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { user: null, error: "Server configuration error" };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: error?.message ?? "Invalid token" };
  }

  return { user: data.user, error: null };
}
