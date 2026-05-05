import cors from 'cors';
import helmet from 'helmet';
import { type RequestHandler } from 'express';
import { env, isProd } from '../../shared/config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

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

/** CORS — only the configured origin is allowed (master spec security §). */
export const corsMiddleware: RequestHandler = cors({
  origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86_400,
});

const allowedOrigins = new Set(env.CORS_ORIGIN.split(',').map((origin) => origin.trim()));
const stateChangingMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const allowedHosts = new Set([...allowedOrigins].map((origin) => new URL(origin).host));

export const originCheckMiddleware: RequestHandler = (req, _res, next) => {
  if (!stateChangingMethods.has(req.method)) {
    next();
    return;
  }

  const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
  if (hasBearerToken) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!allowedOrigins.has(origin)) {
      next(AppError.forbidden('Origin is not allowed for this action'));
      return;
    }

    next();
    return;
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (allowedHosts.has(refererHost)) {
        next();
        return;
      }
    } catch {
      next(AppError.forbidden('Referer is invalid for this action'));
      return;
    }
  }

  next(AppError.forbidden('Origin or Referer header is required for cookie-authenticated writes'));
};
