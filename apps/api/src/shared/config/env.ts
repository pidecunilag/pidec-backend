import 'dotenv/config';
import { z } from 'zod';

/**
 * Server-side environment validation. Process exits with a clear error if
 * any required value is missing or malformed (fail fast, never partially
 * boot the API with bad config).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(process.env.PORT ? parseInt(process.env.PORT) : 4000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // anon key may also be present but the API only uses the service role key
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('PIDEC 1.0 <competitions@pidec.com.ng>'),

  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  RATE_LIMIT_REGISTRATION_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  RATE_LIMIT_REGISTRATION_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_GLOBAL_ANON_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_GLOBAL_AUTH_MAX: z.coerce.number().int().positive().default(500),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid API environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
