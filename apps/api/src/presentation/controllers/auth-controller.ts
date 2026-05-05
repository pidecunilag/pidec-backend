import { type RequestHandler } from 'express';
import { ERROR_CODES, SESSION, stripMatricSeparators } from '@pidec/shared';
import { AuthService } from '../../domain/services/auth-service.js';
import { AuthRepository } from '../../domain/repositories/auth-repository.js';
import { TokenRepository } from '../../domain/repositories/verification-token-repository.js';
import { getVerificationWorkflowService } from '../../domain/services/verification-workflow-service.js';
import { verifyToken } from '../../infrastructure/auth/jwt.js';
import { hashToken } from '../../infrastructure/auth/token-utils.js';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';

const authService = new AuthService();
const verificationWorkflowService = getVerificationWorkflowService();
const authRepository = new AuthRepository();
const tokenRepository = new TokenRepository();

const buildAuthCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

const clearAuthCookieOptions = {
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

const resolveVerificationUploadTarget = async (req: Parameters<RequestHandler>[0]) => {
  if (req.user) {
    return req.user.id;
  }

  const body = req.body as { email?: unknown; matricNumber?: unknown; matric_number?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const matricRaw =
    typeof body.matricNumber === 'string'
      ? body.matricNumber
      : typeof body.matric_number === 'string'
        ? body.matric_number
        : '';
  const matricNumber = stripMatricSeparators(matricRaw);

  if (!email || !matricNumber) {
    throw AppError.validation(
      'Unauthenticated verification uploads require email and matricNumber fields',
    );
  }

  const user = await authRepository.findByEmail(email);
  if (!user || user.deleted_at) {
    throw AppError.notFound('Student account not found for verification upload');
  }

  if (user.role !== 'student') {
    throw AppError.forbidden('Only student accounts can submit verification documents');
  }

  if (stripMatricSeparators(user.matric_number ?? '') !== matricNumber) {
    throw AppError.forbidden('Verification upload details do not match the student account');
  }

  return user.id;
};

/**
 * POST /auth/register
 * Register a new user (student, judge, or admin).
 * Body: { email, password, name, role?, matricNumber?, department?, level? }
 */
export const register: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, name, role = 'student', matricNumber, department, level } = req.body;
    const supabase = getSupabaseService();

    if (role === 'student') {
      const { data, error } = await supabase
        .from('editions')
        .select('id,signup_open')
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();

      const edition = data as { id: string; signup_open: boolean } | null;

      if (error) throw error;
      if (!edition) throw AppError.notFound('No active edition configured');
      if (!edition.signup_open) {
        throw AppError.forbidden('Registrations are not open');
      }
    }

    const { user, tokens } = await authService.register(
      email,
      password,
      name,
      role,
      matricNumber,
      department,
      level,
    );

    // Send verification email
    try {
      await authService.requestEmailVerification(user.id, user.email, user.name);
    } catch (emailErr) {
      logger.error({ userId: user.id, error: emailErr }, 'Failed to send verification email');
      // Don't fail registration if email sending fails
    }

    // Set HTTP-only, Secure, SameSite=Strict cookies
    res.cookie('access-token', tokens.accessToken, buildAuthCookieOptions(SESSION.ACCESS_TOKEN_TTL_MS));

    res.cookie('refresh-token', tokens.refreshToken, buildAuthCookieOptions(SESSION.REFRESH_TOKEN_TTL_MS));

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 * Login user with email and password.
 * Body: { email, password }
 */
export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { user, tokens } = await authService.login(email, password);

    // Set HTTP-only, Secure, SameSite=Strict cookies
    res.cookie('access-token', tokens.accessToken, buildAuthCookieOptions(SESSION.ACCESS_TOKEN_TTL_MS));

    res.cookie('refresh-token', tokens.refreshToken, buildAuthCookieOptions(SESSION.REFRESH_TOKEN_TTL_MS));

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Refresh access token using the refresh token cookie.
 * No body required — uses refresh-token cookie.
 */
export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken =
      (req as unknown as { cookies?: Record<string, string> }).cookies?.['refresh-token'] ?? null;

    if (!refreshToken) {
      throw AppError.unauthenticated('Refresh token missing');
    }

    // Verify refresh token
    const payload = verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw AppError.unauthenticated('Invalid token type');
    }

    if (!payload.sid) {
      throw AppError.unauthenticated('Refresh session is missing');
    }

    const [session, currentUser] = await Promise.all([
      tokenRepository.findRefreshSession(payload.sid),
      authRepository.findById(payload.sub),
    ]);

    if (!session || session.revoked_at || session.token_hash !== hashToken(refreshToken)) {
      throw AppError.unauthenticated('Refresh session is no longer valid');
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await tokenRepository.revokeRefreshSession(session.id);
      throw AppError.unauthenticated('Refresh session has expired');
    }
    if (!currentUser || currentUser.is_suspended) {
      await tokenRepository.revokeAllRefreshSessionsForUser(payload.sub);
      throw AppError.unauthenticated('Account is no longer allowed to refresh sessions');
    }

    // Generate new access token (same payload structure)
    const { generateAccessToken, generateRefreshToken } = await import('../../infrastructure/auth/jwt.js');
    const newAccessToken = generateAccessToken({
      sub: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    });
    const newRefreshToken = generateRefreshToken({
      sub: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      sid: session.id,
    });
    const refreshedSession = await tokenRepository.rotateRefreshSession(
      session.id,
      hashToken(refreshToken),
      hashToken(newRefreshToken),
      new Date(Date.now() + SESSION.REFRESH_TOKEN_TTL_MS),
    );
    if (!refreshedSession) {
      throw AppError.unauthenticated('Refresh token has already been rotated');
    }

    // Set new access token cookie
    res.cookie('access-token', newAccessToken, buildAuthCookieOptions(SESSION.ACCESS_TOKEN_TTL_MS));
    res.cookie('refresh-token', newRefreshToken, buildAuthCookieOptions(SESSION.REFRESH_TOKEN_TTL_MS));

    logger.debug({ userId: currentUser.id }, 'Access token refreshed');

    res.status(200).json({
      status: 'success',
      data: {
        refreshed: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout
 * Logout user by clearing auth cookies.
 * No body required.
 */
export const logout: RequestHandler = async (req, res) => {
  const refreshToken =
    (req as unknown as { cookies?: Record<string, string> }).cookies?.['refresh-token'] ?? null;
  if (refreshToken) {
    try {
      const payload = verifyToken(refreshToken);
      if (payload.type === 'refresh' && payload.sid) {
        await tokenRepository.revokeRefreshSession(payload.sid, hashToken(refreshToken));
      }
    } catch {
      // no-op
    }
  }

  res.clearCookie('access-token', clearAuthCookieOptions);
  res.clearCookie('refresh-token', clearAuthCookieOptions);

  if (req.user) {
    logger.info({ userId: req.user.id }, 'User logged out');
  }

  res.status(200).json({
    status: 'success',
  });
};

/**
 * GET /auth/me
 * Get current authenticated user from JWT.
 * Requires authentication.
 */
export const me: RequestHandler = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'Authentication required',
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    },
  });
};

/**
 * POST /auth/verify-email
 * Verify user's email using a verification token from email.
 * Body: { token }
 */
export const verifyEmailToken: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      throw AppError.validation('Verification token is required');
    }

    const user = await authService.consumeEmailVerificationToken(token);

    logger.info({ userId: user.id, email: user.email }, 'Email verified');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password
 * Request a password reset email.
 * Body: { email }
 * Note: Always returns 200 for security (doesn't reveal if account exists)
 */
export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      throw AppError.validation('Email is required');
    }

    await authService.requestPasswordReset(email);

    // Always return success to avoid user enumeration
    res.status(200).json({
      status: 'success',
      message: 'If an account exists with that email, a password reset link will be sent.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password
 * Reset password using a token from email.
 * Body: { token, password }
 */
export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      throw AppError.validation('Password reset token is required');
    }

    if (!password || typeof password !== 'string') {
      throw AppError.validation('New password is required');
    }

    const user = await authService.consumePasswordResetToken(token, password);

    logger.info({ userId: user.id, email: user.email }, 'Password reset successful');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verification-document
 * Upload a verification document and enqueue async verification.
 * Requires authentication. Multipart form field: document
 */
export const uploadVerificationDocument: RequestHandler = async (req, res, next) => {
  try {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      throw AppError.validation('Verification document is required');
    }

    const userId = await resolveVerificationUploadTarget(req);

    const status = await verificationWorkflowService.submitDocument(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
      originalname: file.originalname,
    });

    res.status(202).json({
      status: 'success',
      data: {
        queued: true,
        verification: status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/verification-status
 * Returns current verification status and re-upload constraints.
 */
export const getVerificationStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const status = await verificationWorkflowService.getStatus(req.user.id);
    res.status(200).json({
      status: 'success',
      data: {
        verification: status,
      },
    });
  } catch (err) {
    next(err);
  }
};
