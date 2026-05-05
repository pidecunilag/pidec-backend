import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env.js';

const devAccessSecret = 'dev-access-token-secret-change-me-before-production-1234';
const devRefreshSecret = 'dev-refresh-token-secret-change-me-before-production-5678';
const ACCESS_TOKEN_SECRET = env.AUTH_ACCESS_TOKEN_SECRET ?? devAccessSecret;
const REFRESH_TOKEN_SECRET = env.AUTH_REFRESH_TOKEN_SECRET ?? devRefreshSecret;
const ACCESS_TOKEN_AUDIENCE = 'pidec-access';
const REFRESH_TOKEN_AUDIENCE = 'pidec-refresh';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: 'student' | 'admin' | 'judge';
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes (in seconds)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days (in seconds)

/**
 * Generate a signed JWT access token.
 */
export const generateAccessToken = (payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string => {
  return jwt.sign(
    { ...payload, type: 'access' },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: env.AUTH_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      subject: payload.sub,
    },
  );
};

/**
 * Generate a signed JWT refresh token.
 */
export const generateRefreshToken = (payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: env.AUTH_TOKEN_ISSUER,
      audience: REFRESH_TOKEN_AUDIENCE,
      subject: payload.sub,
    },
  );
};

/**
 * Verify and decode a JWT token (either access or refresh).
 * Throws if token is invalid or expired.
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object' || !('type' in decoded)) {
      throw new Error('Token payload is malformed');
    }

    const tokenType = decoded.type;
    if (tokenType === 'access') {
      return jwt.verify(token, ACCESS_TOKEN_SECRET, {
        issuer: env.AUTH_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      }) as JwtPayload;
    }

    if (tokenType === 'refresh') {
      return jwt.verify(token, REFRESH_TOKEN_SECRET, {
        issuer: env.AUTH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
      }) as JwtPayload;
    }

    throw new Error('Unsupported token type');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    throw new Error(`Token verification failed: ${message}`);
  }
};

/**
 * Get the token expiry time in seconds (relative to now).
 */
export const getTokenExpirySeconds = (token: string): number => {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded || !decoded.exp) return -1;
  return decoded.exp - Math.floor(Date.now() / 1000);
};
