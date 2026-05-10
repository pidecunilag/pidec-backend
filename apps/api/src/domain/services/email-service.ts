/**
 * Domain port for the email service. Use cases dispatch email events
 * through this interface; the Resend implementation lives in
 * /infrastructure/email/resend-email-service.ts.
 */
export interface EmailRecipient {
  to: string;
  name?: string;
}

export interface EmailDispatchResult {
  id: string;
  delivered: boolean;
}

export interface VerificationApprovedPayload {
  recipientName: string;
  dashboardUrl: string;
}

export interface VerificationRejectedPayload {
  recipientName: string;
  reason: string;
  attemptNumber: number;
  attemptsRemaining: number;
  reuploadUrl: string;
}

export interface VerificationFlaggedPayload {
  recipientName: string;
  dashboardUrl: string;
}

export interface TeamInvitePayload {
  recipientName: string;
  teamName: string;
  inviterName: string;
  expiresAt: string;
  invitesUrl: string;
}

export interface SubmissionConfirmedPayload {
  recipientName: string;
  teamName: string;
  stage: 1 | 2 | 3;
  submittedAt: string;
  dashboardUrl: string;
}

export interface StageAdvancedPayload {
  recipientName: string;
  teamName: string;
  newStage: 2 | 3;
  dashboardUrl: string;
}

export interface FeedbackPublishedPayload {
  recipientName: string;
  teamName: string;
  stage: 1 | 2 | 3;
  feedbackUrl: string;
}

export interface TeamDisqualifiedPayload {
  recipientName: string;
  teamName: string;
  stage: 1 | 2 | 3;
  reason: string;
}

export interface TeamDissolvedPayload {
  recipientName: string;
  teamName: string;
  dashboardUrl: string;
}

export interface EmailVerificationPayload {
  recipientName: string;
  verificationLink: string;
}

export interface PasswordResetPayload {
  recipientName: string;
  resetLink: string;
}

export interface JudgeInvitePayload {
  recipientName: string;
  stageLabel: string;
  departments: string[];
  setupLink: string;
  expiresIn: string;
}

export interface IEmailService {
  sendVerificationApproved(
    to: EmailRecipient,
    p: VerificationApprovedPayload,
  ): Promise<EmailDispatchResult>;
  sendVerificationRejected(
    to: EmailRecipient,
    p: VerificationRejectedPayload,
  ): Promise<EmailDispatchResult>;
  sendVerificationFlagged(
    to: EmailRecipient,
    p: VerificationFlaggedPayload,
  ): Promise<EmailDispatchResult>;
  sendTeamInvite(to: EmailRecipient, p: TeamInvitePayload): Promise<EmailDispatchResult>;
  sendSubmissionConfirmed(
    to: EmailRecipient,
    p: SubmissionConfirmedPayload,
  ): Promise<EmailDispatchResult>;
  sendStageAdvanced(to: EmailRecipient, p: StageAdvancedPayload): Promise<EmailDispatchResult>;
  sendFeedbackPublished(
    to: EmailRecipient,
    p: FeedbackPublishedPayload,
  ): Promise<EmailDispatchResult>;
  sendTeamDisqualified(
    to: EmailRecipient,
    p: TeamDisqualifiedPayload,
  ): Promise<EmailDispatchResult>;
  sendTeamDissolved(to: EmailRecipient, p: TeamDissolvedPayload): Promise<EmailDispatchResult>;
  sendEmailVerification(
    to: EmailRecipient,
    p: EmailVerificationPayload,
  ): Promise<EmailDispatchResult>;
  sendPasswordReset(to: EmailRecipient, p: PasswordResetPayload): Promise<EmailDispatchResult>;
  sendJudgeInvite(to: EmailRecipient, p: JudgeInvitePayload): Promise<EmailDispatchResult>;
}
