/**
 * Supabase session helper for Next.js middleware. Refreshes the session
 * cookie on every request and exposes the current user to the middleware
 * for route-protection decisions.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@pidec/db-types';

export interface MiddlewareSupabaseResult {
  response: NextResponse;
  user: { id: string; email: string | null; role: string } | null;
}

export const getMiddlewareSupabase = async (
  request: NextRequest,
): Promise<MiddlewareSupabaseResult> => {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Env not configured yet — let request through; pages will surface the
    // misconfiguration via the env validator on first render.
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: CookieOptions) => {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.user_metadata?.role as string | undefined) ?? 'student';

  return {
    response,
    user: user ? { id: user.id, email: user.email ?? null, role } : null,
  };
};
