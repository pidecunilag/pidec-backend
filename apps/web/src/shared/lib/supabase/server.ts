/**
 * Server-side Supabase client for use in Server Components, route handlers,
 * and server actions. Reads the user's session from HTTP-only cookies.
 *
 * IMPORTANT: This still uses the anon key — RLS applies. The service role
 * key lives only in the backend api app and never touches the web app.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@pidec/db-types';
import { env } from '../../config/env';

export const getServerSupabase = () => {
  const cookieStore = cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components can't set cookies — middleware handles refresh.
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Same as above.
          }
        },
      },
    },
  );
};
