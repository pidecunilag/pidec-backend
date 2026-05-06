import type { Response } from 'express';
import type { Database } from '@pidec/db-types';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { platformReadService } from '../shared/platform-read-service.js';

type UserRow = Database['public']['Tables']['users']['Row'];
type TeamExportRow = Database['public']['Tables']['teams']['Row'] & {
  leader: { id: string; name: string; email: string } | null;
  submissions: Array<{ id: string; stage: number; status: string; submitted_at: string }>;
};
type SubmissionExportRow = Database['public']['Tables']['submissions']['Row'] & {
  teams: { id: string; name: string; department: string; leader_id: string } | null;
  users: { id: string; name: string; email: string } | null;
};
type JudgeScoreExportRow = Database['public']['Tables']['judge_scores']['Row'] & {
  submissions: {
    id: string;
    team_id: string;
    stage: number;
    teams: { id: string; name: string; department: string } | null;
  } | null;
  judges: { id: string; name: string; email: string; stage_scope: string } | null;
};

const supabase = getSupabaseService();

const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const normalized = text.replace(/\r?\n/g, ' ');
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const toCsv = (rows: Array<Record<string, unknown>>, columns: string[]): string => {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(',')).join('\n');
  return `${header}\n${body}\n`;
};

const sendCsv = (
  res: Response,
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns: string[],
) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(toCsv(rows, columns));
};

export class AdminExportService {
  async exportStudents(res: Response): Promise<void> {
    const edition = await platformReadService.getActiveEdition();
    const { data, error } = await supabase
      .from('users')
      .select(
        'id,name,email,matric_number,department,level,verification_status,verification_method,verification_timestamp,is_suspended,team_id,role,created_at',
      )
      .eq('role', 'student')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []).map((user: Pick<UserRow, 'id' | 'name' | 'email' | 'matric_number' | 'department' | 'level' | 'verification_status' | 'verification_method' | 'verification_timestamp' | 'is_suspended' | 'team_id' | 'role' | 'created_at'>) => ({
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

    sendCsv(res, `pidec-students-${edition.id}.csv`, rows, [
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
    ]);
  }

  async exportTeams(res: Response): Promise<void> {
    const edition = await platformReadService.getActiveEdition();
    const { data, error } = await supabase
      .from('teams')
      .select('*, leader:users!teams_leader_id_fkey(id,name,email), submissions(id,stage,status,submitted_at)')
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const teamRows = (data ?? []) as TeamExportRow[];
    const rows = teamRows.map((team) => ({
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

    const teamIds = rows.map((row) => row.id as string);
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('team_id')
        .in('team_id', teamIds)
        .is('deleted_at', null);

      if (membersError) throw membersError;

      const memberCounts = new Map<string, number>();
      for (const row of (members ?? []) as Array<{ team_id: string | null }>) {
        const teamId = row.team_id;
        if (!teamId) continue;
        memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
      }

      for (const row of rows) {
        row.member_count = memberCounts.get(row.id as string) ?? 0;
      }
    }

    sendCsv(res, `pidec-teams-${edition.id}.csv`, rows, [
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
    ]);
  }

  async exportSubmissions(res: Response, stage?: number): Promise<void> {
    const edition = await platformReadService.getActiveEdition();
    let query = supabase
      .from('submissions')
      .select('*, teams!inner(id,name,department,leader_id), users!submissions_submitted_by_fkey(id,name,email)')
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true });

    if (typeof stage === 'number') query = query.eq('stage', stage);

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as SubmissionExportRow[]).map((submission) => ({
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
  }

  async exportScores(res: Response): Promise<void> {
    const edition = await platformReadService.getActiveEdition();
    const { data, error } = await supabase
      .from('judge_scores')
      .select(
        'id,submission_id,judge_id,scores,comments,total_score,is_representative_pick,submitted_at,submissions!inner(id,team_id,stage,teams!inner(id,name,department)),judges!inner(id,name,email,stage_scope)',
      )
      .is('deleted_at', null)
      .eq('submissions.edition_id', edition.id)
      .order('submitted_at', { ascending: true });

    if (error) throw error;

    const rows = ((data ?? []) as JudgeScoreExportRow[]).map((score) => ({
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

    sendCsv(res, `pidec-scores-${edition.id}.csv`, rows, [
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
    ]);
  }
}

export const adminExportService = new AdminExportService();
