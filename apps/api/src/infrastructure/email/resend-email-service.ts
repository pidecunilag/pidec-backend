import { render } from '@react-email/render';
import { Resend } from 'resend';
import { type ReactElement } from 'react';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';
import type {
  EmailDispatchResult,
  EmailRecipient,
  EmailVerificationPayload,
  FeedbackPublishedPayload,
  IEmailService,
  JudgeInvitePayload,
  PasswordResetPayload,
  StageAdvancedPayload,
  SubmissionConfirmedPayload,
  TeamDisqualifiedPayload,
  TeamDissolvedPayload,
  TeamInvitePayload,
  VerificationApprovedPayload,
  VerificationFlaggedPayload,
  VerificationRejectedPayload,
} from '../../domain/services/email-service.js';
import { VerificationApprovedEmail } from './templates/verification-approved.js';
import { VerificationRejectedEmail } from './templates/verification-rejected.js';
import { VerificationFlaggedEmail } from './templates/verification-flagged.js';
import { TeamInviteEmail } from './templates/team-invite.js';
import { SubmissionConfirmedEmail } from './templates/submission-confirmed.js';
import { StageAdvancedEmail } from './templates/stage-advanced.js';
import { FeedbackPublishedEmail } from './templates/feedback-published.js';
import { TeamDisqualifiedEmail } from './templates/team-disqualified.js';
import { TeamDissolvedEmail } from './templates/team-dissolved.js';
import { VerificationEmail } from './templates/verification-email.js';
import { PasswordResetEmail } from './templates/password-reset-email.js';
import { JudgeInviteEmail } from './templates/judge-invite.js';

/**
 * Resend implementation of IEmailService.
 *
 * If RESEND_API_KEY is not set (e.g. local dev before the domain is
 * verified), the service runs in "log-only" mode: it renders the template,
 * logs the recipient + subject, and returns a synthesised dispatch ID.
 * This lets feature work proceed without sending real email.
 */
export class ResendEmailService implements IEmailService {
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = env.RESEND_FROM_EMAIL;
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
    if (!this.resend) {
      logger.warn('RESEND_API_KEY not set — email service running in log-only mode.');
    }
  }

  private async dispatch(
    to: EmailRecipient,
    subject: string,
    template: ReactElement,
  ): Promise<EmailDispatchResult> {
    const html = await render(template);
    const text = await render(template, { plainText: true });

    if (!this.resend) {
      logger.info({ to: to.to, subject }, 'Email (log-only mode)');
      return { id: `log-only-${Date.now()}`, delivered: false };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: to.name ? `${to.name} <${to.to}>` : to.to,
        subject,
        html,
        text,
      });
      if (error) {
        logger.error({ err: error, subject }, 'Resend dispatch failed');
        return { id: '', delivered: false };
      }
      return { id: data?.id ?? '', delivered: true };
    } catch (err) {
      logger.error({ err, subject }, 'Resend dispatch threw');
      return { id: '', delivered: false };
    }
  }

  sendVerificationApproved(to: EmailRecipient, p: VerificationApprovedPayload) {
    return this.dispatch(
      to,
      "Welcome to PIDEC 1.0 — You're verified",
      VerificationApprovedEmail(p),
    );
  }

  sendVerificationRejected(to: EmailRecipient, p: VerificationRejectedPayload) {
    return this.dispatch(to, 'PIDEC 1.0 — Verification unsuccessful', VerificationRejectedEmail(p));
  }

  sendVerificationFlagged(to: EmailRecipient, p: VerificationFlaggedPayload) {
    return this.dispatch(
      to,
      'Action required — Manual document review',
      VerificationFlaggedEmail(p),
    );
  }

  sendTeamInvite(to: EmailRecipient, p: TeamInvitePayload) {
    return this.dispatch(
      to,
      `${p.teamName} wants you to join their PIDEC team`,
      TeamInviteEmail(p),
    );
  }

  sendSubmissionConfirmed(to: EmailRecipient, p: SubmissionConfirmedPayload) {
    return this.dispatch(
      to,
      `PIDEC 1.0 — Stage ${p.stage} submission received`,
      SubmissionConfirmedEmail(p),
    );
  }

  sendStageAdvanced(to: EmailRecipient, p: StageAdvancedPayload) {
    return this.dispatch(
      to,
      `PIDEC 1.0 — Your team advances to Stage ${p.newStage}`,
      StageAdvancedEmail(p),
    );
  }

  sendFeedbackPublished(to: EmailRecipient, p: FeedbackPublishedPayload) {
    return this.dispatch(
      to,
      `PIDEC 1.0 — Your Stage ${p.stage} feedback is ready`,
      FeedbackPublishedEmail(p),
    );
  }

  sendTeamDisqualified(to: EmailRecipient, p: TeamDisqualifiedPayload) {
    return this.dispatch(
      to,
      'PIDEC 1.0 — Important notice for your team',
      TeamDisqualifiedEmail(p),
    );
  }

  sendTeamDissolved(to: EmailRecipient, p: TeamDissolvedPayload) {
    return this.dispatch(to, 'Your PIDEC 1.0 team has been dissolved', TeamDissolvedEmail(p));
  }

  sendEmailVerification(to: EmailRecipient, p: EmailVerificationPayload) {
    return this.dispatch(to, 'Verify your PIDEC email address', VerificationEmail(p));
  }

  sendPasswordReset(to: EmailRecipient, p: PasswordResetPayload) {
    return this.dispatch(to, 'Reset your PIDEC password', PasswordResetEmail(p));
  }

  sendJudgeInvite(to: EmailRecipient, p: JudgeInvitePayload) {
    return this.dispatch(to, `PIDEC judge invitation for ${p.stageLabel}`, JudgeInviteEmail(p));
  }
}

let cached: ResendEmailService | null = null;
export const getEmailService = (): ResendEmailService => {
  if (cached) return cached;
  cached = new ResendEmailService();
  return cached;
};
