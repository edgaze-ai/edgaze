import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export type AuthResult =
  | { user: User; error: null }
  | { user: null; error: string };

/**
 * Try Bearer first, then fall back to cookie-based session.
 * Returns user and an authenticated Supabase client for storage/RLS operations.
 * Use for routes that may be called with either auth method (e.g. assets, marketplace).
 */
export async function getUserAndClient(
  req: NextRequest | Request
): Promise<{ user: User; supabase: SupabaseClient } | { user: null; supabase: null }> {
  const bearer = await getUserFromRequest(req);
  if (bearer.user) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (url && anon && token) {
      const supabase = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      return { user: bearer.user, supabase };
    }
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    return { user: data.user, supabase };
  }
  return { user: null, supabase: null };
}

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
