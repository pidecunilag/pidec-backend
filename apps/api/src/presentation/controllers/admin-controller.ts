import { randomBytes } from 'node:crypto';
import { type RequestHandler } from 'express';
import { ERROR_CODES } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { hashPassword } from '../../infrastructure/auth/password.js';
import { TokenRepository } from '../../domain/repositories/verification-token-repository.js';
import { AuthService } from '../../domain/services/auth-service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';

const tokenAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const generateTokenString = (): string => {
  const bytes = randomBytes(12);
  let token = '';
  for (const b of bytes) token += tokenAlphabet[b % tokenAlphabet.length];
  return token.slice(0, 12);
};

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
const authService = new AuthService();

const generateSystemMatricNumber = (): string => {
  let digits = '';
  while (digits.length < 9) {
    digits += String(randomBytes(1).readUInt8(0) % 10);
  }
  return digits.slice(0, 9);
};

const isMissingTableError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return /could not find the table|schema cache/i.test(message.toLowerCase());
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

const queueTeamEmailFanout = (
  teamId: string,
  context: string,
  buildTask: (member: { id: string; name: string; email: string }) => Promise<unknown>,
) => {
  fireAndForget(
    (async () => {
      const members = await getTeamMembers(teamId);
      await Promise.allSettled(members.map((member) => buildTask(member)));
    })(),
    context,
  );
};

const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const normalized = text.replace(/\r?\n/g, ' ');
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const toCsv = (rows: Array<Record<string, unknown>>, columns: string[]): string => {
  const header = columns.join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsvCell(row[column])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
};

const sendCsv = (res: any, filename: string, rows: Array<Record<string, unknown>>, columns: string[]) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(toCsv(rows, columns));
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
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('users')
      .select(
        'id,name,email,matric_number,department,level,verification_status,verification_method,verification_timestamp,is_suspended,team_id,role,created_at',
      )
      .eq('role', 'student')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Stage 2 checkpoints are unavailable until migration 0020_stage_2_checkpoints.sql is applied',
        );
      }
      throw error;
    }

    const rows = (data ?? []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      matric_number: user.matric_number,
      department: user.department,
      level: user.level,
      verification_status: user.verification_status,
      verification_method: user.verification_method ?? '',
      verification_timestamp: user.verification_timestamp ?? '',
      is_suspended: user.is_suspended,
      team_id: user.team_id ?? '',
      role: user.role,
      created_at: user.created_at,
      edition_id: edition.id,
    }));

    sendCsv(
      res,
      `pidec-students-${edition.id}.csv`,
      rows,
      [
        'id',
        'name',
        'email',
        'matric_number',
        'department',
        'level',
        'verification_status',
        'verification_method',
        'verification_timestamp',
        'is_suspended',
        'team_id',
        'role',
        'created_at',
        'edition_id',
      ],
    );
  } catch (err) {
    next(err);
  }
};

export const exportTeams: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('teams')
      .select('*, leader:users!teams_leader_id_fkey(id,name,email), submissions(id,stage,status,submitted_at)', { count: 'exact' })
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []).map((team: any) => ({
      id: team.id,
      edition_id: team.edition_id,
      name: team.name,
      department: team.department,
      leader_id: team.leader_id,
      leader_name: team.leader?.name ?? '',
      leader_email: team.leader?.email ?? '',
      current_stage: team.current_stage,
      status: team.status,
      disqualified_at_stage: team.disqualified_at_stage ?? '',
      disqualified_at: team.disqualified_at ?? '',
      disqualified_reason: team.disqualified_reason ?? '',
      is_stage_2_representative: team.is_stage_2_representative,
      member_count: 0,
      submission_count: Array.isArray(team.submissions) ? team.submissions.length : 0,
      created_at: team.created_at,
    }));

    const teamIds = rows.map((row: { id: string }) => row.id);
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('team_id')
        .in('team_id', teamIds)
        .is('deleted_at', null);

      if (membersError) throw membersError;

      const memberCounts = new Map<string, number>();
      for (const row of members ?? []) {
        const teamId = (row as { team_id: string | null }).team_id;
        if (!teamId) continue;
        memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
      }

      for (const row of rows) {
        row.member_count = memberCounts.get(row.id as string) ?? 0;
      }
    }

    sendCsv(
      res,
      `pidec-teams-${edition.id}.csv`,
      rows,
      [
        'id',
        'edition_id',
        'name',
        'department',
        'leader_id',
        'leader_name',
        'leader_email',
        'current_stage',
        'status',
        'disqualified_at_stage',
        'disqualified_at',
        'disqualified_reason',
        'is_stage_2_representative',
        'member_count',
        'submission_count',
        'created_at',
      ],
    );
  } catch (err) {
    next(err);
  }
};

export const exportSubmissions: RequestHandler = async (req, res, next) => {
  try {
    const { stage } = req.query as any;
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('submissions')
      .select('*, teams!inner(id,name,department,leader_id), users!submissions_submitted_by_fkey(id,name,email)', {
        count: 'exact',
      })
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true });

    if (typeof stage === 'number') query = query.eq('stage', stage);

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        res.status(200).json({ status: 'success', data: { checkpoints: [] } });
        return;
      }
      throw error;
    }

    const rows = (data ?? []).map((submission: any) => ({
      id: submission.id,
      team_id: submission.team_id,
      team_name: submission.teams?.name ?? '',
      team_department: submission.teams?.department ?? '',
      edition_id: submission.edition_id,
      submitted_by: submission.submitted_by,
      submitted_by_name: submission.users?.name ?? '',
      submitted_by_email: submission.users?.email ?? '',
      stage: submission.stage,
      status: submission.status,
      is_locked: submission.is_locked,
      token_id: submission.token_id ?? '',
      video_link: submission.video_link ?? '',
      form_data: submission.form_data,
      files: submission.files,
      submitted_at: submission.submitted_at,
      created_at: submission.created_at,
    }));

    sendCsv(
      res,
      `pidec-submissions-${edition.id}${typeof stage === 'number' ? `-stage-${stage}` : ''}.csv`,
      rows,
      [
        'id',
        'team_id',
        'team_name',
        'team_department',
        'edition_id',
        'submitted_by',
        'submitted_by_name',
        'submitted_by_email',
        'stage',
        'status',
        'is_locked',
        'token_id',
        'video_link',
        'form_data',
        'files',
        'submitted_at',
        'created_at',
      ],
    );
  } catch (err) {
    next(err);
  }
};

export const exportScores: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('judge_scores')
      .select(
        'id,submission_id,judge_id,scores,comments,total_score,is_representative_pick,submitted_at,submissions!inner(id,team_id,stage,teams!inner(id,name,department)),judges!inner(id,name,email,stage_scope)',
      )
      .is('deleted_at', null)
      .eq('submissions.edition_id', edition.id)
      .order('submitted_at', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []).map((score: any) => ({
      id: score.id,
      submission_id: score.submission_id,
      team_id: score.submissions?.team_id ?? '',
      team_name: score.submissions?.teams?.name ?? '',
      team_department: score.submissions?.teams?.department ?? '',
      submission_stage: score.submissions?.stage ?? '',
      judge_id: score.judge_id,
      judge_name: score.judges?.name ?? '',
      judge_email: score.judges?.email ?? '',
      judge_stage_scope: score.judges?.stage_scope ?? '',
      scores: score.scores,
      comments: score.comments,
      total_score: score.total_score ?? '',
      is_representative_pick: score.is_representative_pick,
      submitted_at: score.submitted_at,
      edition_id: edition.id,
    }));

    sendCsv(
      res,
      `pidec-scores-${edition.id}.csv`,
      rows,
      [
        'id',
        'submission_id',
        'team_id',
        'team_name',
        'team_department',
        'submission_stage',
        'judge_id',
        'judge_name',
        'judge_email',
        'judge_stage_scope',
        'scores',
        'comments',
        'total_score',
        'is_representative_pick',
        'submitted_at',
        'edition_id',
      ],
    );
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

    const supabase = getSupabaseService() as any;

    if (action === 'advance') {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .is('deleted_at', null)
        .maybeSingle();
      if (teamError) throw teamError;
      if (!team) throw AppError.notFound('Team not found');

      const nextStage = Math.min(3, team.current_stage + 1);
      const advancedStage = nextStage === 2 ? 2 : 3;
      const { data, error } = await supabase
        .from('teams')
        .update({ current_stage: nextStage } as never)
        .eq('id', teamId)
        .select('*')
        .single();
      if (error) throw error;
      queueTeamEmailFanout(teamId, 'team advanced emails', (member) =>
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
      return res.status(200).json({ status: 'success', data: { team: data } });
    }

    if (action === 'disqualify') {
      const { data: teamRecord, error: teamRecordError } = await supabase
        .from('teams')
        .select('id,name')
        .eq('id', teamId)
        .is('deleted_at', null)
        .maybeSingle();
      if (teamRecordError) throw teamRecordError;
      if (!teamRecord) throw AppError.notFound('Team not found');

      const { data, error } = await supabase
        .from('teams')
        .update({
          status: 'disqualified',
          disqualified_at_stage: atStage,
          disqualified_at: new Date().toISOString(),
          disqualified_reason: reason ?? null,
        } as never)
        .eq('id', teamId)
        .select('*')
        .single();

      if (error) throw error;
      queueTeamEmailFanout(teamId, 'team disqualified emails', (member) =>
        getEmailService().sendTeamDisqualified(
          { to: member.email, name: member.name },
          {
            recipientName: member.name,
            teamName: teamRecord.name,
            stage: atStage ?? 1,
            reason: reason ?? 'Your team has been disqualified.',
          },
        ),
      );
      return res.status(200).json({ status: 'success', data: { team: data } });
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({ is_locked: false } as never)
      .eq('team_id', teamId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .select('*');

    if (error) throw error;

    return res.status(200).json({ status: 'success', data: { unlocked: data?.[0] ?? null } });
  } catch (err) {
    next(err);
  }
};

export const generateDepartmentToken: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { department, expiresAt } = req.body as { department: string; expiresAt?: string };
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

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
          created_by: req.user.id,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({ status: 'success', data: { token: data } });
  } catch (err) {
    next(err);
  }
};

export const regenerateDepartmentToken: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { department, expiresAt } = req.body as { department: string; expiresAt?: string };
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

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
          created_by: req.user.id,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({ status: 'success', data: { token: data } });
  } catch (err) {
    next(err);
  }
};

export const createJudge: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { email, name, stageScope, assignedDepartments } = req.body as {
      email: string;
      name: string;
      stageScope: 'stage_1' | 'stage_2';
      assignedDepartments: string[];
    };

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
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
            name,
            email,
            matric_number: generateSystemMatricNumber(),
            department: 'JUDGE',
            level: 500,
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
        createdUser = insertedUser;
        break;
      }

      lastInsertError = insertUserError;
      const message = String((insertUserError as { message?: string } | null)?.message ?? '');
      if (!message.includes('idx_users_matric_unique')) {
        throw insertUserError;
      }
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
          name,
          email,
          stage_scope: stageScope,
          assigned_departments: assignedDepartments,
          created_by: req.user.id,
          is_active: true,
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
    fireAndForget(authService.requestPasswordReset(createdUser.email), 'judge onboarding password reset email');

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

    const supabase = getSupabaseService() as any;

    const feedbackPayload = {
      submission_id: submissionId,
      scores,
      comments,
      total_score: totalScore,
      outcome,
      entered_by_admin: req.user.id,
      evaluator_name: evaluatorName,
      evaluation_date: evaluationDate ?? null,
    };

    const { data: existingFeedback, error: existingFeedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('submission_id', submissionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingFeedbackError) throw existingFeedbackError;

    const feedbackMutation = existingFeedback
      ? supabase
          .from('feedback')
          .update(feedbackPayload as never)
          .eq('id', existingFeedback.id)
      : supabase
          .from('feedback')
          .insert([feedbackPayload] as never[]);

    const { data, error } = await feedbackMutation
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

    res.status(200).json({ status: 'success', data: { feedback: data } });
  } catch (err) {
    next(err);
  }
};

export const publishFeedback: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { submissionIds } = req.body as { submissionIds: string[] };
    const supabase = getSupabaseService() as any;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('feedback')
      .update({ published: true, published_at: now, published_by: req.user.id } as never)
      .in('submission_id', submissionIds)
      .select('*');

    if (error) throw error;

    const { error: submissionStatusError } = await supabase
      .from('submissions')
      .update({ status: 'feedback_published' } as never)
      .in('id', submissionIds);

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

    res.status(200).json({ status: 'success', data: { feedback: data ?? [] } });
  } catch (err) {
    next(err);
  }
};
