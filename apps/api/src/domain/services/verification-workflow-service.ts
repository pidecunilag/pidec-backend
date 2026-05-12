import {
  ERROR_CODES,
  FILE_LIMITS,
  VERIFICATION_DOC_MIME_TYPES,
  VERIFICATION_LIMITS,
} from '@pidec/shared';
import { AuthRepository } from '../repositories/auth-repository.js';
import { getVerificationBufferStore } from '../../infrastructure/verification/buffer-store.js';
import {
  type VerificationJobPayload,
  getVerificationQueue,
} from '../../infrastructure/verification/queue.js';
import {
  type VerificationFinalizationJobPayload,
  getVerificationFinalizationQueue,
} from '../../infrastructure/verification/finalization-queue.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';
import type { DbUser } from '@pidec/db-types';

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
  private readonly finalizationQueue = getVerificationFinalizationQueue();

  constructor() {
    this.queue.registerProcessor(async (payload) => {
      await this.processJob(payload);
    });
    this.finalizationQueue.registerProcessor(async (payload) => {
      await this.processFinalizationJob(payload);
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

    if (
      !VERIFICATION_DOC_MIME_TYPES.includes(
        file.mimetype as (typeof VERIFICATION_DOC_MIME_TYPES)[number],
      )
    ) {
      throw new AppError(
        ERROR_CODES.INVALID_FILE_TYPE,
        'Only PDF, PNG, and JPG documents are allowed',
      );
    }

    if (file.size > FILE_LIMITS.VERIFICATION_DOC_MAX_BYTES) {
      throw new AppError(
        ERROR_CODES.FILE_TOO_LARGE,
        'Verification document must be 5MB or smaller',
      );
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

  private isMatch(
    extractedValue: string | null,
    userValue: string | null,
    isName = false,
  ): boolean {
    if (!extractedValue || !userValue) return false;

    if (isName) {
      // Basic fuzzy match for name (check if all parts of user name are in extracted name)
      const parts = userValue.toLowerCase().split(/\s+/);
      const ext = extractedValue.toLowerCase();
      return parts.every((p) => ext.includes(p));
    }

    return this.normalizeMatric(extractedValue) === this.normalizeMatric(userValue);
  }

  private buildExtractionPrompt(finalPass: boolean): string | undefined {
    if (!finalPass) return undefined;

    return `You are doing a final student identity extraction pass for an exam docket or course registration form.
Inspect the document carefully, including small text, headers, tables, and repeated student-info sections.
Extract only values visible in the document. Do not infer or invent missing values.
Return ONLY a JSON object with this exact structure:
{
  "name": "extracted full student name or null",
  "matricNumber": "extracted matric number or null",
  "department": "extracted department or null",
  "confidence": "high" or "low"
}
Set confidence to "low" if the document is blurry, cropped, not a valid student document, or the name/matric number cannot be read clearly.`;
  }

  private async verifyDocument(
    payload: VerificationJobPayload,
    user: { name: string; matric_number: string },
    options: { finalPass?: boolean } = {},
  ): Promise<VerificationOutcome> {
    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    const buffer = await this.bufferStore.get(payload.bufferKey);
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

    const { extractWithGroq, extractWithGemini } =
      await import('../../infrastructure/verification/ai-extractor.js');
    const prompt = this.buildExtractionPrompt(options.finalPass ?? false);

    let result = await extractWithGroq(buffer, payload.mimeType, prompt);
    let method: 'groq' | 'gemini' | 'manual' = 'groq';

    if (!result || result.confidence === 'low') {
      const geminiResult = await extractWithGemini(buffer, payload.mimeType, prompt);
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

  private async completeVerification(user: DbUser, result: VerificationOutcome): Promise<void> {
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

  private async processJob(payload: VerificationJobPayload): Promise<void> {
    const user = await this.authRepository.findById(payload.userId);
    if (!user) return;

    const result = await this.verifyDocument(payload, user);

    if (result.status === 'flagged') {
      const finalizationPayload: VerificationFinalizationJobPayload = {
        ...payload,
        firstMethod: result.method,
      };
      if (result.reason) finalizationPayload.firstReason = result.reason;

      await this.finalizationQueue.enqueue(finalizationPayload);
      logger.info(
        { userId: user.id, method: result.method, reason: result.reason },
        'Verification first pass was inconclusive; queued silent finalization pass',
      );
      return;
    }

    await this.completeVerification(user, result);
    await this.bufferStore.delete(payload.bufferKey);
  }

  private async processFinalizationJob(payload: VerificationFinalizationJobPayload): Promise<void> {
    try {
      const user = await this.authRepository.findById(payload.userId);
      if (!user) return;

      if (user.verification_status !== 'pending') {
        logger.info(
          { userId: user.id, status: user.verification_status },
          'Skipping verification finalization because user status already changed',
        );
        return;
      }

      const result = await this.verifyDocument(payload, user, { finalPass: true });
      await this.completeVerification(user, result);

      logger.info(
        {
          userId: user.id,
          firstMethod: payload.firstMethod,
          finalMethod: result.method,
          finalStatus: result.status,
          firstReason: payload.firstReason,
          finalReason: result.reason,
        },
        'Verification finalization pass completed',
      );
    } finally {
      await this.bufferStore.delete(payload.bufferKey);
    }
  }
}

let cached: VerificationWorkflowService | null = null;
export const getVerificationWorkflowService = (): VerificationWorkflowService => {
  if (cached) return cached;
  cached = new VerificationWorkflowService();
  return cached;
};
