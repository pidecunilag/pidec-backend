import { type RequestHandler } from 'express';
import {
  ERROR_CODES,
  Stage1SubmitSchema,
  Stage2SubmitSchema,
  Stage3SubmitSchema,
  TEAM_LIMITS,
} from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';

const getActiveEdition = async () => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('No active edition configured');
  return data;
};

const getUser = async (userId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('User not found');
  return data;
};

const getTeam = async (teamId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('Team not found');
  return data;
};

const getTeamMembers = async (teamId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email')
    .eq('team_id', teamId)
    .is('deleted_at', null);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; email: string }>;
};

const queueSubmissionEmails = (teamId: string, teamName: string, stage: 1 | 2 | 3, submittedAt: string) => {
  fireAndForget(
    (async () => {
      const members = await getTeamMembers(teamId);
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

const assertLeaderCanSubmit = async (userId: string, expectedStage: 1 | 2 | 3) => {
  const user = await getUser(userId);
  if (!user.team_id) throw AppError.validation('You must belong to a team');

  const [team, edition] = await Promise.all([getTeam(user.team_id), getActiveEdition()]);

  if (team.leader_id !== user.id) throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only team leader can submit');
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

  const supabase = getSupabaseService() as any;
  const { count: memberCount, error: memberCountError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .is('deleted_at', null);

  if (memberCountError) throw memberCountError;
  if ((memberCount ?? 0) < TEAM_LIMITS.MIN_MEMBERS) {
    throw new AppError(ERROR_CODES.TEAM_TOO_SMALL, 'Team must have at least 3 members to submit');
  }
  if ((memberCount ?? 0) > TEAM_LIMITS.MAX_MEMBERS) {
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

  return { user, team, edition, existing };
};

export const listMySubmissions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const user = await getUser(req.user.id);
    if (!user.team_id) {
      return res.status(200).json({
        status: 'success',
        data: { submissions: [] },
      });
    }

    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', user.team_id)
      .is('deleted_at', null)
      .order('stage', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { submissions: data ?? [] },
    });
  } catch (err) {
    next(err);
  }
};

export const submitStage1: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { token, formData } = req.body as { token: string; formData: Record<string, unknown> };
    const supabase = getSupabaseService() as any;

    const { user, team, edition, existing } = await assertLeaderCanSubmit(req.user.id, 1);
    if (existing) {
      return res
        .status(200)
        .json({ status: 'success', data: { submission: existing, duplicated: true } });
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('edition_id', edition.id)
      .eq('department', team.department)
      .eq('token_string', token)
      .is('deleted_at', null)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) throw new AppError(ERROR_CODES.INVALID_TOKEN, 'Invalid submission token');
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
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
          form_data: formData,
          files: [],
          token_id: tokenRow.id,
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert([
      {
        user_id: team.leader_id,
        type: 'submission_confirmed',
        title: 'Submission received',
        message: `Your Stage 1 submission for ${team.name} has been received.`,
        action_url: '/dashboard',
      },
    ] as never[]);

    await supabase
      .from('tokens')
      .update({
        use_count: tokenRow.use_count + 1,
        last_used_at: new Date().toISOString(),
      } as never)
      .eq('id', tokenRow.id);

    logger.info(
      { submissionId: submission.id, teamId: team.id, stage: 1 },
      'Stage 1 submission created',
    );
    queueSubmissionEmails(team.id, team.name, 1, submission.submitted_at);

    res.status(201).json({
      status: 'success',
      data: { submission },
    });
  } catch (err) {
    next(err);
  }
};

export const submitStage2: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { videoLink, formData, fileIds } = req.body as {
      videoLink: string;
      formData: Record<string, unknown>;
      fileIds: string[];
    };

    const supabase = getSupabaseService() as any;
    const { user, team, edition, existing } = await assertLeaderCanSubmit(req.user.id, 2);
    if (existing) {
      return res
        .status(200)
        .json({ status: 'success', data: { submission: existing, duplicated: true } });
    }

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          submitted_by: user.id,
          stage: 2,
          form_data: formData,
          files: (fileIds ?? []).map((id) => ({ id })),
          video_link: videoLink,
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert([
      {
        user_id: team.leader_id,
        type: 'submission_confirmed',
        title: 'Submission received',
        message: `Your Stage 2 submission for ${team.name} has been received.`,
        action_url: '/dashboard',
      },
    ] as never[]);

    logger.info(
      { submissionId: submission.id, teamId: team.id, stage: 2 },
      'Stage 2 submission created',
    );
    queueSubmissionEmails(team.id, team.name, 2, submission.submitted_at);

    res.status(201).json({
      status: 'success',
      data: { submission },
    });
  } catch (err) {
    next(err);
  }
};

export const submitStage3: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { formData, fileIds } = req.body as {
      formData: Record<string, unknown>;
      fileIds: string[];
    };

    const supabase = getSupabaseService() as any;
    const { user, team, edition, existing } = await assertLeaderCanSubmit(req.user.id, 3);
    if (existing) {
      return res
        .status(200)
        .json({ status: 'success', data: { submission: existing, duplicated: true } });
    }

    const { data: submission, error } = await supabase
      .from('submissions')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          submitted_by: user.id,
          stage: 3,
          form_data: formData,
          files: (fileIds ?? []).map((id) => ({ id })),
          status: 'submitted',
          is_locked: true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert([
      {
        user_id: team.leader_id,
        type: 'submission_confirmed',
        title: 'Submission received',
        message: `Your Stage 3 submission for ${team.name} has been received.`,
        action_url: '/dashboard',
      },
    ] as never[]);

    logger.info(
      { submissionId: submission.id, teamId: team.id, stage: 3 },
      'Stage 3 submission created',
    );
    queueSubmissionEmails(team.id, team.name, 3, submission.submitted_at);

    res.status(201).json({
      status: 'success',
      data: { submission },
    });
  } catch (err) {
    next(err);
  }
};

export const submitCurrentStage: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();

    if (edition.active_stage === 1) {
      req.body = Stage1SubmitSchema.parse(req.body);
      return submitStage1(req, res, next);
    }

    if (edition.active_stage === 2) {
      req.body = Stage2SubmitSchema.parse(req.body);
      return submitStage2(req, res, next);
    }

    if (edition.active_stage === 3) {
      req.body = Stage3SubmitSchema.parse(req.body);
      return submitStage3(req, res, next);
    }

    throw AppError.forbidden('No active submission stage is currently open');
  } catch (err) {
    next(err);
  }
};
