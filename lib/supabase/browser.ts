import { createBrowserClient } from '@supabase/ssr';

/**
 * Singleton Supabase browser client.
 *
 * Uses @supabase/ssr's createBrowserClient which properly stores the session
 * in cookies (not localStorage) so the Next.js proxy.ts can read and validate
 * the session server-side without an extra round-trip.
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
