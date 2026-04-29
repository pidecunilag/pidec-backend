/**
 * Browser-side Supabase client. Uses the anon key. RLS policies in
 * 0016_rls_policies.sql constrain what this client can read/write.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@pidec/db-types';
import { env } from '../../config/env';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export const getBrowserSupabase = () => {
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return cached;
};
