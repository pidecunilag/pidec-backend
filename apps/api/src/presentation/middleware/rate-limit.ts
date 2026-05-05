import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import type { Request } from 'express';
import { env } from '../../shared/config/env.js';
import { ERROR_CODES, type ApiError } from '@pidec/shared';
import { verifyToken } from '../../infrastructure/auth/jwt.js';

const redisClient = env.REDIS_URL ? new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
}) : null;

if (redisClient) {
  redisClient.on('error', () => {
    // Silent fail - the store will fallback to memory if connection fails
  });
}

// Helper to standardise the 429 response
const createRateLimitResponse = (message: string) => {
  return (_req: unknown, res: { status: (code: number) => { json: (body: ApiError) => void } }) => {
    const body: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message,
      },
    };
    res.status(429).json(body);
  };
};

const getRateLimitKey = (req: Request): string => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : null;
  const cookieToken = req.cookies?.['access-token'] ?? null;
  const token = bearer ?? cookieToken;

  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.type === 'access') {
        return `user:${payload.sub}`;
      }
    } catch {
      // fall back to IP key
    }
  }

  return `ip:${req.ip ?? 'unknown'}`;
};

const getGlobalRateLimit = (req: Request): number => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : null;
  const cookieToken = req.cookies?.['access-token'] ?? null;
  const token = bearer ?? cookieToken;

  if (!token) return env.RATE_LIMIT_GLOBAL_ANON_MAX;

  try {
    const payload = verifyToken(token);
    return payload.type === 'access' ? env.RATE_LIMIT_GLOBAL_AUTH_MAX : env.RATE_LIMIT_GLOBAL_ANON_MAX;
  } catch {
    return env.RATE_LIMIT_GLOBAL_ANON_MAX;
  }
};

const redisSendCommand = (...args: string[]): Promise<RedisReply> =>
  redisClient?.call(args[0]!, ...args.slice(1)) as Promise<RedisReply>;

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  limit: getGlobalRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:global:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many requests, please try again later.'),
});

export const registerRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_REGISTRATION_WINDOW_MS,
  limit: env.RATE_LIMIT_REGISTRATION_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:register:',
    })
  } : {}),
  handler: createRateLimitResponse('Registration limit reached, please try again in 10 minutes.'),
});

export const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:login:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many login attempts, please try again in 15 minutes.'),
});

export const refreshRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:refresh:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many refresh attempts, please try again later.'),
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_REGISTRATION_WINDOW_MS,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:forgot-password:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many password reset requests, please try again later.'),
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:password-reset:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many password reset attempts, please try again later.'),
});

export const verifyEmailRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: redisSendCommand,
      prefix: 'rl:verify-email:',
    })
  } : {}),
  handler: createRateLimitResponse('Too many email verification attempts, please try again later.'),
});
