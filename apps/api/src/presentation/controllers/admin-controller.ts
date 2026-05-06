import { type RequestHandler } from 'express';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { TokenRepository } from '../../domain/repositories/verification-token-repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';
import { adminOrchestrationService } from '../../application/admin/admin-orchestration-service.js';
import { adminExportService } from '../../application/admin/admin-export-service.js';

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

const tokenRepository = new TokenRepository();

const isMissingTableError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return /could not find the table|schema cache/i.test(message.toLowerCase());
};

const getCursorPage = <T extends { created_at?: string | null; submitted_at?: string | null }>(
  rows: T[],
  limit: number,
  cursorField: 'created_at' | 'submitted_at',
) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.[cursorField] ?? null) : null;

  return {
    items,
    meta: {
      pageSize: limit,
      hasMore,
      nextCursor,
    },
  };
};

export const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const {
      q,
      role,
      verificationStatus,
      department,
      hasTeam,
      isSuspended,
      cursor,
      limit,
      offset,
    } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    let query = supabase
      .from('users')
      .select('*', { count: cursor ? undefined : 'exact' })
      .is('deleted_at', null);

    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,matric_number.ilike.%${q}%`);
    if (role) query = query.eq('role', role);
    if (verificationStatus) query = query.eq('verification_status', verificationStatus);
    if (department) query = query.eq('department', department);
    if (typeof isSuspended === 'boolean') query = query.eq('is_suspended', isSuspended);
    if (typeof hasTeam === 'boolean') query = hasTeam ? query.not('team_id', 'is', null) : query.is('team_id', null);

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (cursor) {
      const page = getCursorPage(data ?? [], limitNumber, 'created_at');
      res.status(200).json({
        status: 'success',
        data: { users: page.items },
        meta: page.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        users: data ?? [],
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listTeams: RequestHandler = async (req, res, next) => {
  try {
    const { q, department, status, currentStage, cursor, limit, offset } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('teams')
      .select('*, leader:users!teams_leader_id_fkey(id,name,email)', { count: cursor ? undefined : 'exact' })
      .eq('edition_id', edition.id)
      .is('deleted_at', null);

    if (q) query = query.ilike('name', `%${q}%`);
    if (department) query = query.eq('department', department);
    if (status) query = query.eq('status', status);
    if (typeof currentStage === 'number') query = query.eq('current_stage', currentStage);

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const teamPageRows = cursor ? getCursorPage(data ?? [], limitNumber, 'created_at') : null;
    const pageRows = teamPageRows?.items ?? data ?? [];
    const teamIds = pageRows.map((team: { id: string }) => team.id);
    const memberCounts = new Map<string, number>();

    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('team_id')
        .in('team_id', teamIds)
        .is('deleted_at', null);

      if (membersError) throw membersError;
      for (const row of members ?? []) {
        const teamId = (row as { team_id: string | null }).team_id;
        if (!teamId) continue;
        memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
      }
    }

    const teams = pageRows.map((team: any) => ({
      ...team,
      memberCount: memberCounts.get(team.id) ?? 0,
    }));

    if (teamPageRows) {
      res.status(200).json({
        status: 'success',
        data: { teams },
        meta: teamPageRows.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        teams,
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listSubmissions: RequestHandler = async (req, res, next) => {
  try {
    const { q, stage, department, teamId, status, cursor, limit, offset } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('submissions')
      .select('*, teams!inner(id,name,department,status), users!submissions_submitted_by_fkey(id,name,email)', {
        count: cursor ? undefined : 'exact',
      })
      .eq('edition_id', edition.id)
      .is('deleted_at', null);

    if (typeof stage === 'number') query = query.eq('stage', stage);
    if (status) query = query.eq('status', status);
    if (teamId) query = query.eq('team_id', teamId);
    if (department) query = query.eq('teams.department', department);
    if (q) query = query.or(`video_link.ilike.%${q}%,teams.name.ilike.%${q}%`);

    query = query.order('submitted_at', { ascending: false });
    if (cursor) {
      query = query.lt('submitted_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (cursor) {
      const page = getCursorPage(data ?? [], limitNumber, 'submitted_at');
      res.status(200).json({
        status: 'success',
        data: { submissions: page.items },
        meta: page.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        submissions: data ?? [],
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listJudges: RequestHandler = async (req, res, next) => {
  try {
    const { stageScope, isActive, cursor, limit, offset } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('judges')
      .select('*', { count: cursor ? undefined : 'exact' })
      .eq('edition_id', edition.id);

    if (stageScope) query = query.eq('stage_scope', stageScope);
    if (typeof isActive === 'boolean') query = query.eq('is_active', isActive);

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (cursor) {
      const page = getCursorPage(data ?? [], limitNumber, 'created_at');
      res.status(200).json({
        status: 'success',
        data: { judges: page.items },
        meta: page.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        judges: data ?? [],
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listTokens: RequestHandler = async (req, res, next) => {
  try {
    const { department, includeRetired, cursor, limit, offset } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('tokens')
      .select('*', { count: cursor ? undefined : 'exact' })
      .eq('edition_id', edition.id);
    if (!includeRetired) query = query.is('deleted_at', null);
    if (department) query = query.eq('department', department);

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (cursor) {
      const page = getCursorPage(data ?? [], limitNumber, 'created_at');
      res.status(200).json({
        status: 'success',
        data: { tokens: page.items },
        meta: page.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        tokens: data ?? [],
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listVerificationQueue: RequestHandler = async (req, res, next) => {
  try {
    const { status, department, q, cursor, limit, offset } = req.query as any;
    const limitNumber = Number(limit ?? 20);
    const offsetNumber = Number(offset ?? 0);

    const supabase = getSupabaseService() as any;
    let query = supabase
      .from('users')
      .select(
        'id,name,email,matric_number,department,level,verification_status,verification_method,verification_attempts,last_verification_attempt_at,created_at',
        { count: cursor ? undefined : 'exact' },
      )
      .is('deleted_at', null)
      .in('verification_status', ['pending', 'flagged']);

    if (status) query = query.eq('verification_status', status);
    if (department) query = query.eq('department', department);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,matric_number.ilike.%${q}%`);

    query = query.order('created_at', { ascending: false });
    if (cursor) {
      query = query.lt('created_at', cursor).limit(limitNumber + 1);
    } else {
      query = query.range(offsetNumber, offsetNumber + limitNumber - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (cursor) {
      const page = getCursorPage(data ?? [], limitNumber, 'created_at');
      res.status(200).json({
        status: 'success',
        data: { queue: page.items },
        meta: page.meta,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        queue: data ?? [],
        pagination: {
          total: count ?? 0,
          limit: limitNumber,
          offset: offsetNumber,
          hasMore: (offsetNumber + limitNumber) < (count ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const exportStudents: RequestHandler = async (_req, res, next) => {
  try {
    await adminExportService.exportStudents(res);
  } catch (err) {
    next(err);
  }
};

export const exportTeams: RequestHandler = async (_req, res, next) => {
  try {
    await adminExportService.exportTeams(res);
  } catch (err) {
    next(err);
  }
};

export const exportSubmissions: RequestHandler = async (req, res, next) => {
  try {
    const stageValue = (req.query as { stage?: string | number }).stage;
    const parsedStage =
      typeof stageValue === 'number'
        ? stageValue
        : typeof stageValue === 'string' && stageValue.length > 0
          ? Number(stageValue)
          : undefined;
    await adminExportService.exportSubmissions(
      res,
      typeof parsedStage === 'number' && Number.isFinite(parsedStage) ? parsedStage : undefined,
    );
  } catch (err) {
    next(err);
  }
};

export const exportScores: RequestHandler = async (_req, res, next) => {
  try {
    await adminExportService.exportScores(res);
  } catch (err) {
    next(err);
  }
};

export const listStage2Checkpoints: RequestHandler = async (req, res, next) => {
  try {
    const { includeDeleted } = req.query as any;
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('stage_2_checkpoints')
      .select('*')
      .eq('edition_id', edition.id)
      .eq('stage', 2)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeDeleted) query = query.is('deleted_at', null);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        res.status(200).json({ status: 'success', data: { checkpoints: [] } });
        return;
      }
      throw error;
    }

    res.status(200).json({ status: 'success', data: { checkpoints: data ?? [] } });
  } catch (err) {
    next(err);
  }
};

export const createStage2Checkpoint: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const { title, description, dueAt, sortOrder, isActive } = req.body as any;

    const { data, error } = await supabase
      .from('stage_2_checkpoints')
      .insert([
        {
          edition_id: edition.id,
          stage: 2,
          title,
          description: description ?? null,
          due_at: dueAt ?? null,
          sort_order: sortOrder ?? 0,
          is_active: isActive ?? true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    res.status(201).json({ status: 'success', data: { checkpoint: data } });
  } catch (err) {
    next(err);
  }
};

export const updateStage2Checkpoint: RequestHandler = async (req, res, next) => {
  try {
    const { checkpointId } = req.params as { checkpointId: string };
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const patch = req.body as any;

    const { data, error } = await supabase
      .from('stage_2_checkpoints')
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.dueAt !== undefined ? { due_at: patch.dueAt } : {}),
        ...(patch.sortOrder !== undefined ? { sort_order: patch.sortOrder } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      } as never)
      .eq('id', checkpointId)
      .eq('edition_id', edition.id)
      .eq('stage', 2)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    res.status(200).json({ status: 'success', data: { checkpoint: data } });
  } catch (err) {
    next(err);
  }
};

export const deleteStage2Checkpoint: RequestHandler = async (req, res, next) => {
  try {
    const { checkpointId } = req.params as { checkpointId: string };
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('stage_2_checkpoints')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', checkpointId)
      .eq('edition_id', edition.id)
      .eq('stage', 2)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    res.status(200).json({ status: 'success', data: { checkpoint: data } });
  } catch (err) {
    next(err);
  }
};

export const getOverview: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const [usersRes, teamsRes, submissionsRes, judgesRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('teams').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .is('deleted_at', null),
      supabase
        .from('judges')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .eq('is_active', true),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (teamsRes.error) throw teamsRes.error;
    if (submissionsRes.error) throw submissionsRes.error;
    if (judgesRes.error) throw judgesRes.error;

    res.status(200).json({
      status: 'success',
      data: {
        edition,
        counts: {
          users: usersRes.count ?? 0,
          teams: teamsRes.count ?? 0,
          submissions: submissionsRes.count ?? 0,
          activeJudges: judgesRes.count ?? 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateEdition: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('editions')
      .update(req.body as never)
      .eq('id', edition.id)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { edition: data } });
  } catch (err) {
    next(err);
  }
};

export const setActiveStage: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const { stage } = req.body as { stage: 0 | 1 | 2 | 3 };

    const { data, error } = await supabase
      .from('editions')
      .update({ active_stage: stage } as never)
      .eq('id', edition.id)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { edition: data } });
  } catch (err) {
    next(err);
  }
};

export const toggleSignup: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const { open } = req.body as { open: boolean };

    const { data, error } = await supabase
      .from('editions')
      .update({ signup_open: open } as never)
      .eq('id', edition.id)
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: { edition: data } });
  } catch (err) {
    next(err);
  }
};

export const toggleSubmissionWindow: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const { open } = req.body as { open: boolean };

    const { data, error } = await supabase
      .from('editions')
      .update({ submission_window_open: open } as never)
      .eq('id', edition.id)
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: { edition: data } });
  } catch (err) {
    next(err);
  }
};

export const toggleTeamLock: RequestHandler = async (req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const { open } = req.body as { open: boolean };

    const { data, error } = await supabase
      .from('editions')
      .update({ team_management_locked: !open } as never)
      .eq('id', edition.id)
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: { edition: data } });
  } catch (err) {
    next(err);
  }
};

export const verificationDecision: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string };
    const { decision, reason, note } = req.body as {
      decision: 'approve' | 'reject' | 'request_resubmission';
      reason?: string;
      note?: string;
    };

    const supabase = getSupabaseService() as any;
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id,name,email')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingUserError) throw existingUserError;
    if (!existingUser) throw AppError.notFound('User not found');

    const patch =
      decision === 'approve'
        ? {
            verification_status: 'verified',
            verification_timestamp: new Date().toISOString(),
            suspension_reason: null,
          }
        : decision === 'reject'
          ? {
              verification_status: 'rejected',
              suspension_reason: reason ?? null,
            }
          : {
              verification_status: 'pending',
              suspension_reason: note ?? null,
            };

    const { data, error } = await supabase
      .from('users')
      .update(patch as never)
      .eq('id', userId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    if (decision === 'approve') {
      fireAndForget(
        getEmailService().sendVerificationApproved(
          { to: existingUser.email, name: existingUser.name },
          {
            recipientName: existingUser.name,
            dashboardUrl: `${env.APP_URL}/dashboard`,
          },
        ),
        'manual verification approval email',
      );
    } else if (decision === 'reject') {
      fireAndForget(
        getEmailService().sendVerificationRejected(
          { to: existingUser.email, name: existingUser.name },
          {
            recipientName: existingUser.name,
            reason: reason ?? 'Your verification could not be approved.',
            attemptNumber: 0,
            attemptsRemaining: 0,
            reuploadUrl: `${env.APP_URL}/auth/register`,
          },
        ),
        'manual verification rejection email',
      );
    } else {
      fireAndForget(
        getEmailService().sendVerificationFlagged(
          { to: existingUser.email, name: existingUser.name },
          {
            recipientName: existingUser.name,
            dashboardUrl: `${env.APP_URL}/dashboard`,
          },
        ),
        'manual verification flagged email',
      );
    }

    res.status(200).json({ status: 'success', data: { user: data } });
  } catch (err) {
    next(err);
  }
};

export const suspendUser: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string };
    const { reason } = req.body as { reason: string };
    const supabase = getSupabaseService() as any;

    const { data, error } = await supabase
      .from('users')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspension_reason: reason,
      } as never)
      .eq('id', userId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }
    await tokenRepository.revokeAllRefreshSessionsForUser(userId);

    res.status(200).json({ status: 'success', data: { user: data } });
  } catch (err) {
    next(err);
  }
};

export const unsuspendUser: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string };
    const supabase = getSupabaseService() as any;

    const { data, error } = await supabase
      .from('users')
      .update({
        is_suspended: false,
        suspended_at: null,
        suspension_reason: null,
      } as never)
      .eq('id', userId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { user: data } });
  } catch (err) {
    next(err);
  }
};

export const applyTeamAction: RequestHandler = async (req, res, next) => {
  try {
    const { teamId } = req.params as { teamId: string };
    const { action, reason, atStage } = req.body as {
      action: 'advance' | 'disqualify' | 'unlock_submission';
      reason?: string;
      atStage?: 1 | 2 | 3;
    };
    const result = await adminOrchestrationService.applyTeamAction(teamId, action, {
      ...(reason !== undefined ? { reason } : {}),
      ...(atStage !== undefined ? { atStage } : {}),
    });
    return res.status(200).json({ status: 'success', data: result.team ? { team: result.team } : { unlocked: result.unlocked } });
  } catch (err) {
    next(err);
  }
};

export const generateDepartmentToken: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { department, expiresAt } = req.body as { department: string; expiresAt?: string };
    const data = await adminOrchestrationService.generateDepartmentToken(req.user.id, department, expiresAt);
    res.status(201).json({ status: 'success', data: { token: data } });
  } catch (err) {
    next(err);
  }
};

export const regenerateDepartmentToken: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { department, expiresAt } = req.body as { department: string; expiresAt?: string };
    const data = await adminOrchestrationService.generateDepartmentToken(req.user.id, department, expiresAt);
    res.status(201).json({ status: 'success', data: { token: data } });
  } catch (err) {
    next(err);
  }
};

export const createJudge: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { email, name, stageScope, assignedDepartments } = req.body as {
      email: string;
      name: string;
      stageScope: 'stage_1' | 'stage_2';
      assignedDepartments: string[];
    };
    const data = await adminOrchestrationService.createJudge(req.user.id, {
      email,
      name,
      stageScope,
      assignedDepartments,
    });
    res.status(201).json({ status: 'success', data: { judge: data } });
  } catch (err) {
    next(err);
  }
};

export const deactivateJudge: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { judgeId } = req.params as { judgeId: string };
    const supabase = getSupabaseService() as any;

    const { data, error } = await supabase
      .from('judges')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: req.user.id,
      } as never)
      .eq('id', judgeId)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { judge: data } });
  } catch (err) {
    next(err);
  }
};

export const enterFeedback: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { submissionId } = req.params as { submissionId: string };
    const { scores, comments, totalScore, outcome, evaluatorName, evaluationDate } = req.body as {
      scores: Record<string, number>;
      comments: Record<string, string>;
      totalScore: number;
      outcome: 'advanced' | 'not_advanced' | 'pending';
      evaluatorName: string;
      evaluationDate?: string;
    };

    const data = await adminOrchestrationService.enterFeedback(req.user.id, submissionId, {
      scores,
      comments,
      totalScore,
      outcome,
      evaluatorName,
      ...(evaluationDate !== undefined ? { evaluationDate } : {}),
    });
    res.status(200).json({ status: 'success', data: { feedback: data } });
  } catch (err) {
    next(err);
  }
};

export const publishFeedback: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { submissionIds } = req.body as { submissionIds: string[] };
    const data = await adminOrchestrationService.publishFeedback(req.user.id, submissionIds);
    res.status(200).json({ status: 'success', data: { feedback: data ?? [] } });
  } catch (err) {
    next(err);
  }
};
