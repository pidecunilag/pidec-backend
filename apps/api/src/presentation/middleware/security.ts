import cors from 'cors';
import helmet from 'helmet';
import { type RequestHandler } from 'express';
import { env, isProd } from '../../shared/config/env.js';

/** Helmet config — strict in production, slightly relaxed in dev. */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: isProd
    ? {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          // Resend webhook + Supabase URL allowed
          connectSrc: ["'self'", env.NEXT_PUBLIC_SUPABASE_URL, 'https://api.resend.com'],
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/** CORS — allow every browser origin. Auth still relies on bearer tokens, not cookies. */
export const corsMiddleware: RequestHandler = cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-refresh-token'],
  maxAge: 86_400,
});

export const originCheckMiddleware: RequestHandler = (_req, _res, next) => {
  next();
};
