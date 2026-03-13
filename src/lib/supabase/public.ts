import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let publicBrowserClient: SupabaseClient | null = null;

export function createSupabasePublicBrowserClient() {
  if (publicBrowserClient) return publicBrowserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key-for-prerender";

  publicBrowserClient = createClient(
    url,
    anonKey,
    {
      auth: {
        // marketplace browsing should NOT manage auth state
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  return publicBrowserClient;
}
