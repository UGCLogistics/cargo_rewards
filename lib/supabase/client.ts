import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Dipakai di komponen client (React) / AuthContext.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
