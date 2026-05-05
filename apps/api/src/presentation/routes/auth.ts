import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  me,
  verifyEmailToken,
  forgotPassword,
  resetPassword,
  uploadVerificationDocument,
  getVerificationStatus,
} from '../controllers/auth-controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { parseVerificationDocumentUpload } from '../middleware/upload.js';
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  verifyEmailRateLimiter,
} from '../middleware/rate-limit.js';
import {
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ForgotPasswordSchema,
  PasswordResetSchema,
} from '@pidec/shared';

const authRouter = Router();

// Public routes (no authentication required)
authRouter.post('/register', registerRateLimiter, validate(RegisterSchema), register);
authRouter.post('/login', loginRateLimiter, validate(LoginSchema), login);
authRouter.post('/refresh', refreshRateLimiter, refresh);
authRouter.post('/verify-email', verifyEmailRateLimiter, validate(VerifyEmailSchema), verifyEmailToken);
authRouter.post('/forgot-password', forgotPasswordRateLimiter, validate(ForgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', passwordResetRateLimiter, validate(PasswordResetSchema), resetPassword);

// Protected routes (authentication required)
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, me);
authRouter.post(
  '/verification-document',
  parseVerificationDocumentUpload,
  uploadVerificationDocument,
);
authRouter.post(
  '/reupload-doc',
  parseVerificationDocumentUpload,
  uploadVerificationDocument,
);
authRouter.get('/verification-status', requireAuth, getVerificationStatus);

export { authRouter };
