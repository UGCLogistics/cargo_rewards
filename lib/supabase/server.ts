import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client untuk Next.js App Router.
 * Menggunakan cookie Next.js untuk menyimpan session.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        /**
         * Untuk Next.js 13/14, cookies() hanya writable di server actions
         * / route handlers. Jika kamu perlu set cookie di situ, fungsi ini
         * akan dipanggil oleh Supabase.
         */
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );
}
