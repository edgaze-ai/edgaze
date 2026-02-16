import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let publicBrowserClient: SupabaseClient | null = null;

export function createSupabasePublicBrowserClient() {
  if (publicBrowserClient) return publicBrowserClient;

  publicBrowserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
