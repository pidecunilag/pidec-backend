import { randomBytes } from 'node:crypto';
import type { Database } from '@pidec/db-types';
import { ERROR_CODES } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { hashPassword } from '../../infrastructure/auth/password.js';
import { AuthService } from '../../domain/services/auth-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';
import {
  platformReadService,
  type FeedbackRow,
  type TeamMemberSummary,
} from '../shared/platform-read-service.js';

type JudgeRow = Database['public']['Tables']['judges']['Row'];

const authService = new AuthService();
const supabase = getSupabaseService();

const tokenAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const generateTokenString = (): string => {
  const bytes = randomBytes(12);
  let token = '';
  for (const b of bytes) token += tokenAlphabet[b % tokenAlphabet.length];
  return token.slice(0, 12);
};

const generateSystemMatricNumber = (): string => {
  let digits = '';
  while (digits.length < 9) {
    digits += String(randomBytes(1).readUInt8(0) % 10);
  }
  return digits.slice(0, 9);
};

const getJudgeStageLabel = (stageScope: 'stage_1' | 'stage_2'): string =>
  stageScope === 'stage_1' ? 'Stage 1' : 'Stage 2';

const queueTeamEmailFanout = (
  members: TeamMemberSummary[],
  context: string,
  buildTask: (member: TeamMemberSummary) => Promise<unknown>,
) => {
  fireAndForget(Promise.allSettled(members.map((member) => buildTask(member))), context);
};

export class AdminOrchestrationService {
  async applyTeamAction(teamId: string, action: 'advance' | 'disqualify' | 'unlock_submission', options: { reason?: string; atStage?: 1 | 2 | 3 }) {
    if (action === 'advance') {
      const team = await platformReadService.getTeamById(teamId);
      const nextStage = Math.min(3, team.current_stage + 1) as 1 | 2 | 3;
      const advancedStage = nextStage === 2 ? 2 : 3;

      const { data, error } = await supabase
        .from('teams')
        .update({ current_stage: nextStage } as never)
        .eq('id', teamId)
        .select('*')
        .single();

      if (error) throw error;

      const members = await platformReadService.listTeamMembers(teamId);
      queueTeamEmailFanout(members, 'team advanced emails', (member) =>
        getEmailService().sendStageAdvanced(
          { to: member.email, name: member.name },
          {
            recipientName: member.name,
            teamName: team.name,
            newStage: advancedStage,
            dashboardUrl: `${env.APP_URL}/dashboard`,
          },
        ),
      );

      return { team: data, unlocked: null };
    }

    if (action === 'disqualify') {
      const team = await platformReadService.getTeamById(teamId);
      const { data, error } = await supabase
        .from('teams')
        .update({
          status: 'disqualified',
          disqualified_at_stage: options.atStage,
          disqualified_at: new Date().toISOString(),
          disqualified_reason: options.reason ?? null,
        } as never)
        .eq('id', teamId)
        .select('*')
        .single();

      if (error) throw error;

      const members = await platformReadService.listTeamMembers(teamId);
      queueTeamEmailFanout(members, 'team disqualified emails', (member) =>
        getEmailService().sendTeamDisqualified(
          { to: member.email, name: member.name },
          {
            recipientName: member.name,
            teamName: team.name,
            stage: options.atStage ?? 1,
            reason: options.reason ?? 'Your team has been disqualified.',
          },
        ),
      );

      return { team: data, unlocked: null };
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({ is_locked: false } as never)
      .eq('team_id', teamId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .select('*');

    if (error) throw error;
    return { team: null, unlocked: data?.[0] ?? null };
  }

  async createJudge(
    adminUserId: string,
    payload: {
      email: string;
      name: string;
      stageScope: 'stage_1' | 'stage_2';
      assignedDepartments: string[];
    },
  ): Promise<JudgeRow> {
    const edition = await platformReadService.getActiveEdition();

    const normalizedEmail = payload.email.toLowerCase().trim();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (userError) throw userError;
    if (user) throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'A user account already exists for this email');

    const generatedPassword = randomBytes(24).toString('hex');
    const passwordHash = await hashPassword(generatedPassword);

    let createdUser: { id: string; email: string; name: string } | null = null;
    let lastInsertError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: insertedUser, error: insertUserError } = await supabase
        .from('users')
        .insert([
          {
            name: payload.name,
            email: normalizedEmail,
            matric_number: generateSystemMatricNumber(),
            department: 'JUDGE',
            level: 500,
            email_verified_at: new Date().toISOString(),
            verification_status: 'verified',
            verification_method: 'manual',
            verification_timestamp: new Date().toISOString(),
            password_hash: passwordHash,
            role: 'judge',
          },
        ] as never[])
        .select('id,email,name')
        .single();

      if (!insertUserError && insertedUser) {
        createdUser = insertedUser as { id: string; email: string; name: string };
        break;
      }

      lastInsertError = insertUserError;
      const message = String((insertUserError as { message?: string } | null)?.message ?? '');
      if (!message.includes('idx_users_matric_unique')) throw insertUserError;
    }

    if (!createdUser) {
      throw lastInsertError instanceof Error ? lastInsertError : AppError.internal('Could not create judge account');
    }

    const { data, error } = await supabase
      .from('judges')
      .insert([
        {
          id: createdUser.id,
          edition_id: edition.id,
          name: payload.name,
          email: normalizedEmail,
          stage_scope: payload.stageScope,
          assigned_departments: payload.assignedDepartments,
          created_by: adminUserId,
          is_active: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    fireAndForget(
      authService.createPasswordSetupToken(createdUser.id).then((token) =>
        getEmailService().sendJudgeInvite(
          { to: createdUser.email, name: createdUser.name },
          {
            recipientName: createdUser.name,
            stageLabel: getJudgeStageLabel(payload.stageScope),
            departments: payload.assignedDepartments,
            setupLink: `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}&invite=judge`,
            expiresIn: '24 hours',
          },
        ),
      ),
      'judge onboarding invitation email',
    );
    return data;
  }

  async enterFeedback(
    adminUserId: string,
    submissionId: string,
    payload: {
      scores: Record<string, number>;
      comments: Record<string, string>;
      totalScore: number;
      outcome: 'advanced' | 'not_advanced' | 'pending';
      evaluatorName: string;
      evaluationDate?: string;
    },
  ): Promise<FeedbackRow> {
    const feedbackPayload = {
      submission_id: submissionId,
      scores: payload.scores,
      comments: payload.comments,
      total_score: payload.totalScore,
      outcome: payload.outcome,
      entered_by_admin: adminUserId,
      evaluator_name: payload.evaluatorName,
      evaluation_date: payload.evaluationDate ?? null,
    };

    const { data: existingFeedback, error: existingFeedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingFeedbackError) throw existingFeedbackError;

    const mutation = existingFeedback
      ? supabase
          .from('feedback')
          .update(feedbackPayload as never)
          .eq('id', (existingFeedback as { id: string }).id)
      : supabase.from('feedback').insert([feedbackPayload] as never[]);

    const { data, error } = await mutation.select('*').single();
    if (error) throw error;
    return data;
  }

  async publishFeedback(adminUserId: string, submissionIds: string[]) {
    const now = new Date().toISOString();

    const [{ data: feedback, error: feedbackError }, { error: submissionStatusError }] =
      await Promise.all([
        supabase
          .from('feedback')
          .update({ published: true, published_at: now, published_by: adminUserId } as never)
          .in('submission_id', submissionIds)
          .select('*'),
        supabase
          .from('submissions')
          .update({ status: 'feedback_published' } as never)
          .in('id', submissionIds),
      ]);

    if (feedbackError) throw feedbackError;
    if (submissionStatusError) throw submissionStatusError;

    const { data: feedbackRecipients, error: feedbackRecipientsError } = await supabase
      .from('submissions')
      .select('id,stage,teams!inner(id,name), users!submissions_submitted_by_fkey(id,name,email)')
      .in('id', submissionIds)
      .is('deleted_at', null);

    if (feedbackRecipientsError) throw feedbackRecipientsError;

    for (const row of feedbackRecipients ?? []) {
      const recipient = (row as { users?: { name?: string; email?: string } | null }).users;
      const team = (row as { teams?: { name?: string } | null }).teams;
      if (!recipient?.email || !recipient.name || !team?.name) continue;

      fireAndForget(
        getEmailService().sendFeedbackPublished(
          { to: recipient.email, name: recipient.name },
          {
            recipientName: recipient.name,
            teamName: team.name,
            stage: (row as { stage: 1 | 2 | 3 }).stage,
            feedbackUrl: `${env.APP_URL}/dashboard/feedback`,
          },
        ),
        `feedback published email for submission ${(row as { id: string }).id}`,
      );
    }

    return feedback ?? [];
  }

  async generateDepartmentToken(adminUserId: string, department: string, expiresAt?: string | null) {
    const edition = await platformReadService.getActiveEdition();

    const { error: retireError } = await supabase
      .from('tokens')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('edition_id', edition.id)
      .eq('department', department)
      .is('deleted_at', null);

    if (retireError) throw retireError;

    const tokenString = generateTokenString();
    const { data, error } = await supabase
      .from('tokens')
      .insert([
        {
          edition_id: edition.id,
          department,
          token_string: tokenString,
          expires_at: expiresAt ?? null,
          created_by: adminUserId,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}

export const adminOrchestrationService = new AdminOrchestrationService();
