import {
  ERROR_CODES,
  TEAM_LIMITS,
  type Stage1SubmitInput,
  type Stage2SubmitInput,
  type Stage3SubmitInput,
} from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';
import {
  platformReadService,
  type SubmissionRow,
  type TeamRow,
  type UserRow,
} from '../shared/platform-read-service.js';

const supabase = getSupabaseService();

type SubmitContext = {
  user: UserRow;
  team: TeamRow;
  edition: Awaited<ReturnType<typeof platformReadService.getActiveEdition>>;
  existing: SubmissionRow | null;
};

const queueSubmissionEmails = (teamId: string, teamName: string, stage: 1 | 2 | 3, submittedAt: string) => {
  fireAndForget(
    (async () => {
      const members = await platformReadService.listTeamMembers(teamId);
      await Promise.allSettled(
        members.map((member) =>
          getEmailService().sendSubmissionConfirmed(
            { to: member.email, name: member.name },
            {
              recipientName: member.name,
              teamName,
              stage,
              submittedAt,
              dashboardUrl: `${env.APP_URL}/dashboard`,
            },
          ),
        ),
      );
    })(),
    `submission confirmed emails for team ${teamId}`,
  );
};

export class SubmissionApplicationService {
  async listMySubmissions(userId: string): Promise<SubmissionRow[]> {
    const user = await platformReadService.getUserById(userId);
    if (!user.team_id) return [];

    const { data, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', user.team_id)
      .is('deleted_at', null)
      .order('stage', { ascending: true });

    if (submissionsError) throw submissionsError;
    return data ?? [];
  }

  async submitStage1(userId: string, payload: Stage1SubmitInput): Promise<{ submission: SubmissionRow; duplicated: boolean }> {
    const { user, team, edition, existing } = await this.assertLeaderCanSubmit(userId, 1);
    if (existing) return { submission: existing, duplicated: true };

    const { data: tokenRow, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('edition_id', edition.id)
      .eq('department', team.department)
      .eq('token_string', payload.token)
      .is('deleted_at', null)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid submission token');
    const tokenRecord = tokenRow as { id: string; expires_at: string | null; use_count: number };
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Submission token has expired');
    }

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          submitted_by: user.id,
          stage: 1,
          form_data: payload.formData,
          files: [],
          token_id: tokenRecord.id,
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;
    const createdSubmission = submission as SubmissionRow;

    await Promise.all([
      supabase.from('notifications').insert([
        {
          user_id: team.leader_id,
          type: 'submission_confirmed',
          title: 'Submission received',
          message: `Your Stage 1 submission for ${team.name} has been received.`,
          action_url: '/dashboard',
        },
      ] as never[]),
      supabase
        .from('tokens')
        .update({
          use_count: tokenRecord.use_count + 1,
          last_used_at: new Date().toISOString(),
        } as never)
        .eq('id', tokenRecord.id),
    ]);

    logger.info({ submissionId: createdSubmission.id, teamId: team.id, stage: 1 }, 'Stage 1 submission created');
    queueSubmissionEmails(team.id, team.name, 1, createdSubmission.submitted_at);

    return { submission: createdSubmission, duplicated: false };
  }

  async submitStage2(userId: string, payload: Stage2SubmitInput): Promise<{ submission: SubmissionRow; duplicated: boolean }> {
    const { user, team, edition, existing } = await this.assertLeaderCanSubmit(userId, 2);
    if (existing) return { submission: existing, duplicated: true };

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          submitted_by: user.id,
          stage: 2,
          form_data: payload.formData,
          files: (payload.fileIds ?? []).map((id) => ({ id })),
          video_link: payload.videoLink,
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;
    const createdSubmission = submission as SubmissionRow;

    await supabase.from('notifications').insert([
      {
        user_id: team.leader_id,
        type: 'submission_confirmed',
        title: 'Submission received',
        message: `Your Stage 2 submission for ${team.name} has been received.`,
        action_url: '/dashboard',
      },
    ] as never[]);

    logger.info({ submissionId: createdSubmission.id, teamId: team.id, stage: 2 }, 'Stage 2 submission created');
    queueSubmissionEmails(team.id, team.name, 2, createdSubmission.submitted_at);
    return { submission: createdSubmission, duplicated: false };
  }

  async submitStage3(userId: string, payload: Stage3SubmitInput): Promise<{ submission: SubmissionRow; duplicated: boolean }> {
    const { user, team, edition, existing } = await this.assertLeaderCanSubmit(userId, 3);
    if (existing) return { submission: existing, duplicated: true };

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          submitted_by: user.id,
          stage: 3,
          form_data: payload.formData,
          files: (payload.fileIds ?? []).map((id) => ({ id })),
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;
    const createdSubmission = submission as SubmissionRow;

    await supabase.from('notifications').insert([
      {
        user_id: team.leader_id,
        type: 'submission_confirmed',
        title: 'Submission received',
        message: `Your Stage 3 submission for ${team.name} has been received.`,
        action_url: '/dashboard',
      },
    ] as never[]);

    logger.info({ submissionId: createdSubmission.id, teamId: team.id, stage: 3 }, 'Stage 3 submission created');
    queueSubmissionEmails(team.id, team.name, 3, createdSubmission.submitted_at);
    return { submission: createdSubmission, duplicated: false };
  }

  async getCurrentStage(): Promise<1 | 2 | 3> {
    const edition = await platformReadService.getActiveEdition();
    if (edition.active_stage === 1 || edition.active_stage === 2 || edition.active_stage === 3) {
      return edition.active_stage;
    }
    throw AppError.forbidden('No active submission stage is currently open');
  }

  private async assertLeaderCanSubmit(userId: string, expectedStage: 1 | 2 | 3): Promise<SubmitContext> {
    const user = await platformReadService.getUserById(userId);
    if (!user.team_id) throw AppError.validation('You must belong to a team');

    const [team, edition] = await Promise.all([
      platformReadService.getTeamById(user.team_id),
      platformReadService.getActiveEdition(),
    ]);

    if (team.leader_id !== user.id) {
      throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only team leader can submit');
    }
    if (team.status !== 'active') throw AppError.forbidden('Team is not active');
    if (!edition.submission_window_open) {
      throw new AppError(ERROR_CODES.SUBMISSION_WINDOW_CLOSED, 'Submission window is closed');
    }
    if (edition.active_stage !== expectedStage) {
      throw new AppError(
        ERROR_CODES.STAGE_CLOSED,
        `Only Stage ${edition.active_stage} submissions are currently open`,
      );
    }

    const memberCount = await platformReadService.countTeamMembers(team.id);
    if (memberCount < TEAM_LIMITS.MIN_MEMBERS) {
      throw new AppError(ERROR_CODES.TEAM_TOO_SMALL, 'Team must have at least 3 members to submit');
    }
    if (memberCount > TEAM_LIMITS.MAX_MEMBERS) {
      throw new AppError(ERROR_CODES.TEAM_FULL, 'Team exceeds the maximum allowed number of members');
    }

    const { data: existing, error: existingError } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', team.id)
      .eq('edition_id', edition.id)
      .eq('stage', expectedStage)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) throw existingError;
    return { user, team, edition, existing: existing ?? null };
  }
}

export const submissionApplicationService = new SubmissionApplicationService();
