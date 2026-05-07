import { type RequestHandler } from 'express';
import { verifyToken } from '../../infrastructure/auth/jwt.js';
import { AuthRepository } from '../../domain/repositories/auth-repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'student' | 'admin' | 'judge';
  email_verified_at: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Reads a JWT access token from the `Authorization: Bearer` header, verifies it using our custom JWT secret,
 * and attaches the user to req.user.
 *
 * Throws AUTH_REQUIRED if no valid token is present.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : null;
    const token = bearer;
    if (!token) throw AppError.unauthenticated();

    // Verify JWT token with custom secret
    const payload = verifyToken(token);

    // Ensure token is an access token, not a refresh token
    if (payload.type !== 'access') {
      throw AppError.unauthenticated('Invalid token type');
    }

    const authRepository = new AuthRepository();
    const currentUser = await authRepository.findById(payload.sub);
    if (!currentUser || currentUser.is_suspended) {
      throw AppError.unauthenticated('Session is no longer valid');
    }

    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      email_verified_at: currentUser.email_verified_at ?? null,
    };

    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    logger.debug({ message }, 'Auth: token verification failed');
    next(AppError.unauthenticated('Session expired or invalid'));
  }
};

export const requireRole =
  (...roles: AuthenticatedUser['role'][]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthenticated());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
