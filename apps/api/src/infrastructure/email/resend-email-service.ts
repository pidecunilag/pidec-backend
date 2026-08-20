import { render } from '@react-email/render';
import { type ReactElement } from 'react';
import { Resend } from 'resend';
import type {
  EmailDispatchResult,
  EmailRecipient,
  EmailVerificationPayload,
  FinaleRegistrationConfirmedPayload,
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
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';
import { FeedbackPublishedEmail } from './templates/feedback-published.js';
import { FinaleRegistrationConfirmedEmail } from './templates/finale-registration-confirmed.js';
import { JudgeInviteEmail } from './templates/judge-invite.js';
import { PasswordResetEmail } from './templates/password-reset-email.js';
import { Stage1SubmissionReminderEmail } from './templates/stage1-submission-reminder.js';
import { StageAdvancedEmail } from './templates/stage-advanced.js';
import { SubmissionConfirmedEmail } from './templates/submission-confirmed.js';
import { TeamDisqualifiedEmail } from './templates/team-disqualified.js';
import { TeamDissolvedEmail } from './templates/team-dissolved.js';
import { TeamInviteEmail } from './templates/team-invite.js';
import { VerificationApprovedEmail } from './templates/verification-approved.js';
import { VerificationEmail } from './templates/verification-email.js';
import { VerificationFlaggedEmail } from './templates/verification-flagged.js';
import { VerificationRejectedEmail } from './templates/verification-rejected.js';

type ParsedEmailAddress = {
  email: string;
  name?: string;
};

type BrevoSendResponse = {
  messageId?: string;
};

/**
 * Resend-first email implementation.
 *
 * If Resend fails or is unavailable, the service immediately attempts Brevo
 * when BREVO_API_KEY is configured. If neither provider is configured, local
 * development stays in log-only mode.
 */
export class ResendEmailService implements IEmailService {
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly brevoApiKey: string | null;
  private readonly brevoFromAddress: string;

  constructor() {
    this.fromAddress = env.RESEND_FROM_EMAIL;
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
    this.brevoApiKey = env.BREVO_API_KEY ?? null;
    this.brevoFromAddress = env.BREVO_FROM_EMAIL ?? this.fromAddress;

    if (!this.resend && !this.brevoApiKey) {
      logger.warn('No email provider API key set - email service running in log-only mode.');
    } else if (!this.resend && this.brevoApiKey) {
      logger.warn('RESEND_API_KEY not set - email service will use Brevo as primary provider.');
    } else if (this.resend && !this.brevoApiKey) {
      logger.warn('BREVO_API_KEY not set - Resend fallback provider is unavailable.');
    }
  }

  private parseEmailAddress(address: string): ParsedEmailAddress {
    const trimmed = address.trim();
    const match = trimmed.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
    if (!match) return { email: trimmed };

    const name = match[1]?.trim();
    return {
      email: match[2]?.trim() ?? trimmed,
      ...(name ? { name } : {}),
    };
  }

  private async dispatchViaBrevo(
    to: EmailRecipient,
    subject: string,
    html: string,
    text: string,
  ): Promise<EmailDispatchResult> {
    if (!this.brevoApiKey) {
      logger.error({ to: to.to, subject }, 'Brevo fallback skipped because BREVO_API_KEY is not set');
      return { id: '', delivered: false };
    }

    const sender = this.parseEmailAddress(this.brevoFromAddress);

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to.to, ...(to.name ? { name: to.name } : {}) }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      const body = (await response.json().catch(() => null)) as BrevoSendResponse | null;

      if (!response.ok) {
        logger.error({ body, status: response.status, subject }, 'Brevo fallback dispatch failed');
        return { id: '', delivered: false };
      }

      return {
        id: body?.messageId ? `brevo:${body.messageId}` : `brevo:${Date.now()}`,
        delivered: true,
      };
    } catch (err) {
      logger.error({ err, subject }, 'Brevo fallback dispatch threw');
      return { id: '', delivered: false };
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
      if (this.brevoApiKey) {
        logger.warn({ to: to.to, subject }, 'Resend unavailable; dispatching through Brevo');
        return this.dispatchViaBrevo(to, subject, html, text);
      }

      logger.info({ to: to.to, subject }, 'Email (log-only mode; no provider configured)');
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
        logger.error({ err: error, subject }, 'Resend dispatch failed; attempting Brevo fallback');
        return this.dispatchViaBrevo(to, subject, html, text);
      }
      return { id: data?.id ?? '', delivered: true };
    } catch (err) {
      logger.error({ err, subject }, 'Resend dispatch threw; attempting Brevo fallback');
      return this.dispatchViaBrevo(to, subject, html, text);
    }
  }

  sendVerificationApproved(to: EmailRecipient, p: VerificationApprovedPayload) {
    return this.dispatch(
      to,
      "Welcome to PIDEC 1.0 - You're verified",
      VerificationApprovedEmail(p),
    );
  }

  sendVerificationRejected(to: EmailRecipient, p: VerificationRejectedPayload) {
    return this.dispatch(to, 'PIDEC 1.0 - Verification unsuccessful', VerificationRejectedEmail(p));
  }

  sendVerificationFlagged(to: EmailRecipient, p: VerificationFlaggedPayload) {
    return this.dispatch(to, 'Action required - Manual document review', VerificationFlaggedEmail(p));
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
      `PIDEC 1.0 - Stage ${p.stage} submission received`,
      SubmissionConfirmedEmail(p),
    );
  }

  sendStageAdvanced(to: EmailRecipient, p: StageAdvancedPayload) {
    return this.dispatch(
      to,
      `PIDEC 1.0 - Your team advances to Stage ${p.newStage}`,
      StageAdvancedEmail(p),
    );
  }

  sendFeedbackPublished(to: EmailRecipient, p: FeedbackPublishedPayload) {
    return this.dispatch(
      to,
      `PIDEC 1.0 - Your Stage ${p.stage} feedback is ready`,
      FeedbackPublishedEmail(p),
    );
  }

  sendTeamDisqualified(to: EmailRecipient, p: TeamDisqualifiedPayload) {
    return this.dispatch(to, 'PIDEC 1.0 - Important notice for your team', TeamDisqualifiedEmail(p));
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

  sendFinaleRegistrationConfirmed(to: EmailRecipient, p: FinaleRegistrationConfirmedPayload) {
    return this.dispatch(
      to,
      `You're registered for the PIDEC 1.0 Grand Finale`,
      FinaleRegistrationConfirmedEmail(p),
    );
  }

  sendStage1PendingSubmissionReminder(
    to: EmailRecipient,
    p: { recipientName: string; teamName: string; daysLeft: number; deadlineLabel: string },
  ) {
    const dayLabel = p.daysLeft === 1 ? 'day' : 'days';
    return this.dispatch(
      to,
      `${p.daysLeft} ${dayLabel} left to submit your PIDEC Stage 1 proposal`,
      Stage1SubmissionReminderEmail(p),
    );
  }
}

let cached: ResendEmailService | null = null;
export const getEmailService = (): ResendEmailService => {
  if (cached) return cached;
  cached = new ResendEmailService();
  return cached;
};
