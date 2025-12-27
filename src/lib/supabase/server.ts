import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // If called from a Server Component (not Route Handler), setting cookies may fail.
          // That's okay; the session is still readable.
        }
      },
    },
  });
}
