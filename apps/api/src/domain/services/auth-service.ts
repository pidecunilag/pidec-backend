import { AuthRepository } from '../repositories/auth-repository.js';
import { TokenRepository } from '../repositories/verification-token-repository.js';
import { hashPassword, verifyPassword } from '../../infrastructure/auth/password.js';
import { generateAccessToken, generateRefreshToken } from '../../infrastructure/auth/jwt.js';
import {
  generateSecureToken,
  hashToken,
  isTokenExpired,
  getTokenExpiryMinutes,
} from '../../infrastructure/auth/token-utils.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { DbUser } from '@pidec/db-types';
import { ERROR_CODES } from '@pidec/shared';
import { env } from '../../shared/config/env.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: DbUser;
  tokens: AuthTokens;
}

/**
 * Core authentication business logic. Use cases:
 * - Register user with email/password
 * - Login user with email/password
 * - Refresh access token with refresh token
 * - Verify user credentials
 * - Email verification and password reset flows
 */
export class AuthService {
  private authRepository = new AuthRepository();
  private tokenRepository = new TokenRepository();

  /**
   * Register a new user (student, judge, or admin).
   * Checks for duplicate email and validates input.
   */
  async register(
    email: string,
    password: string,
    name: string,
    role: 'student' | 'admin' | 'judge' = 'student',
    matricNumber?: string,
    department?: string,
    level?: number,
  ): Promise<AuthResult> {
    // Validation
    email = email.toLowerCase().trim();
    if (!this.isValidEmail(email)) {
      throw AppError.validation('Invalid email format');
    }
    if (password.length < 8) {
      throw AppError.validation('Password must be at least 8 characters');
    }
    if (!name.trim()) {
      throw AppError.validation('Name is required');
    }

    // Check if user already exists
    const existing = await this.authRepository.findByEmail(email);
    if (existing) {
      throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await this.authRepository.createUser(
      email,
      passwordHash,
      name.trim(),
      role,
      matricNumber,
      department,
      level,
    );

    // Generate tokens
    const tokens = this.generateTokens(user);

    return { user, tokens };
  }

  /**
   * Login user with email and password.
   * Verifies credentials and generates new tokens.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    email = email.toLowerCase().trim();

    // Find user
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Check if user is suspended/inactive
    if (user.deleted_at) {
      throw AppError.forbidden('Account has been deactivated');
    }
    if (user.is_suspended) {
      throw new AppError(ERROR_CODES.ACCOUNT_SUSPENDED, 'Account has been suspended');
    }

    // Verify password
    if (!user.password_hash) {
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    return { user, tokens };
  }

  /**
   * Refresh access token using a refresh token.
   * The refresh token must be valid and of type 'refresh'.
   */
  async refresh(): Promise<AuthTokens> {
    // This will be implemented in the controller layer once token verification is added
    // For now, just throw so refresh endpoint knows what to do
    throw AppError.internal('Token refresh not yet implemented in service layer');
  }

  /**
   * Verify a user's email address (marks as verified in DB).
   */
  async verifyEmail(userId: string): Promise<DbUser> {
    return this.authRepository.markVerified(userId);
  }

  /**
   * Request email verification by creating a verification token.
   * Returns the raw token to be sent in the verification email.
   */
  async requestEmailVerification(
    userId: string,
    userEmail: string,
    userName: string,
  ): Promise<string> {
    // Generate secure token
    const { token, hash } = generateSecureToken();

    // Token expires in 24 hours
    const expiresAt = getTokenExpiryMinutes(24 * 60);

    // Store hashed token
    await this.tokenRepository.createVerificationToken(userId, hash, expiresAt);

    // Send verification email
    const emailService = getEmailService();
    await emailService.sendEmailVerification(
      { to: userEmail, name: userName },
      {
        recipientName: userName,
        verificationLink: `${env.APP_URL}/auth/verify-email?token=${token}`,
      },
    );

    // Return raw token to be sent in email
    return token;
  }

  /**
   * Verify an email using the token sent in the verification email.
   */
  async consumeEmailVerificationToken(token: string): Promise<DbUser> {
    // Hash the token to compare with stored hash
    const tokenHash = hashToken(token);

    // Find token
    const verToken = await this.tokenRepository.findVerificationToken(tokenHash);
    if (!verToken) {
      throw AppError.validation('Invalid verification link');
    }

    // Check if expired
    if (isTokenExpired(verToken.expires_at)) {
      throw AppError.validation('Verification link has expired');
    }

    // Check if already used
    if (verToken.used_at) {
      throw AppError.validation('Verification link has already been used');
    }

    // Mark token as used
    await this.tokenRepository.markVerificationTokenUsed(verToken.id);

    // Mark user as verified
    const user = await this.verifyEmail(verToken.user_id);

    return user;
  }

  /**
   * Request a password reset by creating a reset token.
   * Returns the raw token to be sent in the reset email.
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    email = email.toLowerCase().trim();

    // Find user (don't expose if user exists)
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      // Return null to indicate user not found (without revealing it)
      return null;
    }

    // Generate secure token
    const { token, hash } = generateSecureToken();

    // Token expires in 1 hour
    const expiresAt = getTokenExpiryMinutes(60);

    // Store hashed token
    await this.tokenRepository.createPasswordResetToken(user.id, hash, expiresAt);

    // Send password reset email
    const emailService = getEmailService();
    await emailService.sendPasswordReset(
      { to: user.email, name: user.name },
      {
        recipientName: user.name,
        resetLink: `${env.APP_URL}/auth/reset-password?token=${token}`,
      },
    );

    // Return raw token to be sent in email
    return token;
  }

  /**
   * Reset password using a reset token.
   */
  async consumePasswordResetToken(token: string, newPassword: string): Promise<DbUser> {
    // Validate new password
    if (newPassword.length < 8) {
      throw AppError.validation('Password must be at least 8 characters');
    }

    // Hash the token to compare with stored hash
    const tokenHash = hashToken(token);

    // Find token
    const resetToken = await this.tokenRepository.findPasswordResetToken(tokenHash);
    if (!resetToken) {
      throw AppError.validation('Invalid password reset link');
    }

    // Check if expired
    if (isTokenExpired(resetToken.expires_at)) {
      throw AppError.validation('Password reset link has expired');
    }

    // Check if already used
    if (resetToken.used_at) {
      throw AppError.validation('Password reset link has already been used');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    const user = await this.authRepository.updatePasswordHash(resetToken.user_id, passwordHash);

    // Mark token as used
    await this.tokenRepository.markPasswordResetTokenUsed(resetToken.id);

    return user;
  }

  /**
   * Generate access and refresh token pair for a user.
   */
  private generateTokens(user: DbUser): AuthTokens {
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as 'student' | 'admin' | 'judge',
    };

    return {
      accessToken: generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload),
    };
  }

  /**
   * Simple email validation (basic format check).
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
