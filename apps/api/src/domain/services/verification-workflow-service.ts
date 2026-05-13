import { ERROR_CODES, FILE_LIMITS, VERIFICATION_DOC_MIME_TYPES, VERIFICATION_LIMITS } from '@pidec/shared';
import { AuthRepository } from '../repositories/auth-repository.js';
import { getVerificationBufferStore } from '../../infrastructure/verification/buffer-store.js';
import {
  type VerificationJobPayload,
  getVerificationQueue,
} from '../../infrastructure/verification/queue.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';

export interface VerificationStatusView {
  status: 'pending' | 'verified' | 'rejected' | 'flagged' | 'suspended';
  attempts: number;
  attemptsRemaining: number;
  cooldownRemainingMs: number;
  lastAttemptAt: string | null;
  method: 'groq' | 'gemini' | 'manual' | null;
  timestamp: string | null;
}

type VerificationOutcome = {
  status: 'verified' | 'flagged' | 'rejected';
  method: 'groq' | 'gemini' | 'manual';
  reason?: string;
};

export class VerificationWorkflowService {
  private readonly authRepository = new AuthRepository();
  private readonly bufferStore = getVerificationBufferStore();
  private readonly queue = getVerificationQueue();

  constructor() {
    this.queue.registerProcessor(async (payload) => {
      await this.processJob(payload);
    });
  }

  private getCooldownRemainingMs(lastAttemptAt: string | null): number {
    if (!lastAttemptAt) return 0;
    const elapsed = Date.now() - new Date(lastAttemptAt).getTime();
    return Math.max(0, VERIFICATION_LIMITS.COOLDOWN_MS - elapsed);
  }

  private buildStatusView(user: {
    verification_status: 'pending' | 'verified' | 'rejected' | 'flagged' | 'suspended';
    verification_attempts: number;
    last_verification_attempt_at: string | null;
    verification_method: 'groq' | 'gemini' | 'manual' | null;
    verification_timestamp: string | null;
  }): VerificationStatusView {
    const attempts = user.verification_attempts ?? 0;
    return {
      status: user.verification_status,
      attempts,
      attemptsRemaining: Math.max(0, VERIFICATION_LIMITS.MAX_ATTEMPTS - attempts),
      cooldownRemainingMs: this.getCooldownRemainingMs(user.last_verification_attempt_at),
      lastAttemptAt: user.last_verification_attempt_at,
      method: user.verification_method,
      timestamp: user.verification_timestamp,
    };
  }

  async getStatus(userId: string): Promise<VerificationStatusView> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw AppError.notFound('User profile not found');
    return this.buildStatusView(user);
  }

  async submitDocument(
    userId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname: string;
    },
  ): Promise<VerificationStatusView> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw AppError.notFound('User profile not found');

    if (user.verification_status === 'verified') {
      throw AppError.validation('Account is already verified');
    }

    if (user.role !== 'student') {
      throw AppError.forbidden('Only student accounts can submit verification documents');
    }

    if (!VERIFICATION_DOC_MIME_TYPES.includes(file.mimetype as (typeof VERIFICATION_DOC_MIME_TYPES)[number])) {
      throw new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Only PDF, PNG, and JPG documents are allowed');
    }

    if (file.size > FILE_LIMITS.VERIFICATION_DOC_MAX_BYTES) {
      throw new AppError(ERROR_CODES.FILE_TOO_LARGE, 'Verification document must be 5MB or smaller');
    }

    const attempts = user.verification_attempts ?? 0;
    if (attempts >= VERIFICATION_LIMITS.MAX_ATTEMPTS) {
      throw new AppError(
        ERROR_CODES.REUPLOAD_LIMIT_REACHED,
        'Maximum verification upload attempts reached',
      );
    }

    const cooldownRemainingMs = this.getCooldownRemainingMs(user.last_verification_attempt_at);
    if (attempts > 0 && cooldownRemainingMs > 0) {
      throw new AppError(
        ERROR_CODES.REUPLOAD_COOLDOWN_ACTIVE,
        'Please wait before uploading another verification document',
        { cooldownRemainingMs },
      );
    }

    const now = new Date().toISOString();
    const nextAttempts = attempts + 1;

    const updatedUser = await this.authRepository.updateVerificationState(user.id, {
      verification_status: 'pending',
      verification_method: null,
      verification_timestamp: null,
      verification_attempts: nextAttempts,
      last_verification_attempt_at: now,
    });

    const bufferKey = `verification-doc:${user.id}:${Date.now()}`;
    await this.bufferStore.set(bufferKey, file.buffer, VERIFICATION_LIMITS.REDIS_BUFFER_TTL_S);

    await this.queue.enqueue({
      userId: user.id,
      bufferKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    return this.buildStatusView(updatedUser);
  }

  private normalizeMatric(matric: string | null): string {
    if (!matric) return '';
    return matric.replace(/[\s/-]/g, '').toUpperCase();
  }

  private normalizeName(name: string | null): string {
    if (!name) return '';
    return name.replace(/\s+/g, '').toLowerCase();
  }

  private isMatch(extractedValue: string | null, userValue: string | null, isName = false): boolean {
    if (!extractedValue || !userValue) return false;
    
    if (isName) {
      // Basic fuzzy match for name (check if all parts of user name are in extracted name)
      const parts = userValue.toLowerCase().split(/\s+/);
      const ext = extractedValue.toLowerCase();
      return parts.every(p => ext.includes(p));
    }
    
    return this.normalizeMatric(extractedValue) === this.normalizeMatric(userValue);
  }

  private async verifyDocument(payload: VerificationJobPayload, user: { name: string, matric_number: string }): Promise<VerificationOutcome> {
    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    const buffer = await this.bufferStore.take(payload.bufferKey);
    if (!buffer) {
      return {
        status: 'flagged',
        method: 'manual',
        reason: 'Document buffer expired before processing; please re-upload.',
      };
    }

    if (!hasGroq && !hasGemini) {
      return {
        status: 'flagged',
        method: 'manual',
        reason: 'Automated AI verification is unavailable in this environment.',
      };
    }

    const { extractWithGroq, extractWithGemini } = await import('../../infrastructure/verification/ai-extractor.js');

    let result = await extractWithGroq(buffer, payload.mimeType);
    let method: 'groq' | 'gemini' | 'manual' = 'groq';

    if (!result || result.confidence === 'low') {
      const geminiResult = await extractWithGemini(buffer, payload.mimeType);
      if (geminiResult) {
         result = geminiResult;
         method = 'gemini';
      }
    }

    if (!result) {
      return {
        status: 'flagged',
        method: 'manual',
        reason: 'Automated extraction failed; admin review required.',
      };
    }

    if (result.confidence === 'low') {
       return {
        status: 'flagged',
        method,
        reason: 'Automated extraction produced low-confidence results; admin review required.',
      };
    }

    const nameMatch = this.isMatch(result.name, user.name, true);
    const matricMatch = this.isMatch(result.matricNumber, user.matric_number, false);

    if (nameMatch && matricMatch) {
       return {
         status: 'verified',
         method,
       };
    }

    return {
      status: 'rejected',
      method,
      reason: 'Name or matric number did not match the document details.',
    };
  }

  private async processJob(payload: VerificationJobPayload): Promise<void> {
    const user = await this.authRepository.findById(payload.userId);
    if (!user) return;

    const result = await this.verifyDocument(payload, user);
    const now = new Date().toISOString();

    await this.authRepository.updateVerificationState(user.id, {
      verification_status: result.status,
      verification_method: result.method,
      verification_timestamp: result.status === 'verified' ? now : null,
    });

    const emailService = getEmailService();

    if (result.status === 'verified') {
      await emailService.sendVerificationApproved(
        { to: user.email, name: user.name },
        {
          recipientName: user.name,
          dashboardUrl: `${env.APP_URL}/dashboard`,
        },
      );
      return;
    }

    if (result.status === 'rejected') {
      const attempts = user.verification_attempts ?? 0;
      await emailService.sendVerificationRejected(
        { to: user.email, name: user.name },
        {
          recipientName: user.name,
          reason: result.reason ?? 'Document details did not match your registration details.',
          attemptNumber: attempts,
          attemptsRemaining: Math.max(0, VERIFICATION_LIMITS.MAX_ATTEMPTS - attempts),
          reuploadUrl: `${env.APP_URL}/auth/register`,
        },
      );
      return;
    }

    await emailService.sendVerificationFlagged(
      { to: user.email, name: user.name },
      {
        recipientName: user.name,
        dashboardUrl: `${env.APP_URL}/dashboard`,
      },
    );

    logger.info(
      { userId: user.id, method: result.method, reason: result.reason },
      'Verification job completed with flagged result',
    );
  }
}

let cached: VerificationWorkflowService | null = null;
export const getVerificationWorkflowService = (): VerificationWorkflowService => {
  if (cached) return cached;
  cached = new VerificationWorkflowService();
  return cached;
};
