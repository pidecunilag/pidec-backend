/**
 * Type-safe environment variables for the web app.
 *
 * Only NEXT_PUBLIC_* values are read on the client; server-only secrets
 * (none in this file — service role key lives in the api app, never here)
 * would go in a separate server-only module if ever needed.
 */

import { z } from 'zod';

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_PLATFORM_EMAIL: z.string().email().default('competitions@pidec.com.ng'),
});

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_PLATFORM_EMAIL: process.env.NEXT_PUBLIC_PLATFORM_EMAIL,
});

if (!parsed.success) {
  // During build with no env, surface the issue clearly.
  // eslint-disable-next-line no-console
  console.error('❌ Invalid public env:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See error above.');
}

export const env = parsed.data;
