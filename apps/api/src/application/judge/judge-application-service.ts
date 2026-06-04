import type { Database } from '@pidec/db-types';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { env } from '../../shared/config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { platformReadService } from '../shared/platform-read-service.js';

const SUBMISSION_BUCKET = 'submissions';
const JUDGE_EXCLUDED_TEAM_IDS = new Set(
  (env.JUDGE_EXCLUDED_TEAM_IDS ?? '')
    .split(',')
    .map((teamId) => teamId.trim())
    .filter(Boolean),
);

type SubmissionWithDepartment = Database['public']['Tables']['submissions']['Row'] & {
  teams: { id: string; department: string; name?: string | null; status?: string | null } | null;
  users?: { id: string; name: string; email: string } | null;
};

type StoredSubmissionFile = {
  id?: string;
  url?: string;
  filename?: string;
};

const STAGE_1_SCORE_LIMITS = {
  problem_statement_clarity: 20,
  proposed_solution_quality: 30,
  theme_alignment: 20,
  feasibility_assessment: 20,
  departmental_relevance: 10,
} as const;

type Stage1ScorePayload = {
  scores: Record<keyof typeof STAGE_1_SCORE_LIMITS, number>;
  comments: Record<string, string | undefined>;
};

export class JudgeApplicationService {
  private readonly supabase = getSupabaseService();

  async getJudgeInfo(judgeId: string) {
    const [edition, judge] = await Promise.all([
      platformReadService.getActiveEdition(),
      platformReadService.getJudgeById(judgeId),
    ]);

    return { edition, judge };
  }

  async listJudgeSubmissions(judgeId: string, requestedStage: number) {
    if (![1, 2, 3].includes(requestedStage)) throw AppError.validation('Invalid stage');

    const [edition, judge] = await Promise.all([
      platformReadService.getActiveEdition(),
      platformReadService.getJudgeById(judgeId),
    ]);

    const allowedStage = judge.stage_scope === 'stage_1' ? 1 : 2;
    if (requestedStage !== allowedStage) {
      throw AppError.forbidden('Requested stage is outside judge scope');
    }
    if (edition.active_stage < allowedStage) {
      throw AppError.forbidden('Judge submissions are not available for this stage yet');
    }

    const { data, error } = await this.supabase
      .from('submissions')
      .select('*, teams!inner(id,name,department,status), users!submissions_submitted_by_fkey(id,name,email)')
      .eq('edition_id', edition.id)
      .eq('stage', requestedStage)
      .is('deleted_at', null)
      .in('teams.department', judge.assigned_departments)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    const submissions = ((data ?? []) as SubmissionWithDepartment[]).filter(
      (submission) => !this.isExcludedTeamSubmission(submission),
    );
    const submissionIds = submissions.map((submission) => submission.id);
    if (submissionIds.length === 0) return [];

    const { data: scoreRows, error: scoreError } = await this.supabase
      .from('judge_scores')
      .select('*')
      .eq('judge_id', judgeId)
      .in('submission_id', submissionIds)
      .is('deleted_at', null);

    if (scoreError) throw scoreError;

    const scoresBySubmission = new Map(
      (scoreRows ?? []).map((score) => [(score as { submission_id: string }).submission_id, score]),
    );

    return submissions.map((submission) => ({
      ...submission,
      judge_score: scoresBySubmission.get(submission.id) ?? null,
    }));
  }

  async submitStage1Score(judgeId: string, submissionId: string, payload: Stage1ScorePayload) {
    const judge = await platformReadService.getJudgeById(judgeId);
    if (judge.stage_scope !== 'stage_1') {
      throw AppError.forbidden('Judge is not scoped for Stage 1');
    }

    const submission = await this.getSubmissionWithDepartment(submissionId, 1);
    const department = submission.teams?.department;
    if (!department) throw AppError.notFound('Submission team could not be resolved');
    if (!judge.assigned_departments.includes(department)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    const totalScore = Object.entries(STAGE_1_SCORE_LIMITS).reduce((sum, [key, max]) => {
      const value = payload.scores[key as keyof typeof STAGE_1_SCORE_LIMITS];
      if (value < 0 || value > max) {
        throw AppError.validation(`${key} must be between 0 and ${max}`);
      }
      return sum + value;
    }, 0);

    const comments = Object.fromEntries(
      Object.entries(payload.comments ?? {}).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
    );

    return this.upsertJudgeScore(submissionId, judgeId, {
      scores: payload.scores,
      comments,
      total_score: Number(totalScore.toFixed(2)),
      is_representative_pick: false,
    });
  }

  async pickDepartmentRepresentative(
    judgeId: string,
    department: string,
    submissionId: string,
    comments?: string,
  ) {
    const judge = await platformReadService.getJudgeById(judgeId);
    if (judge.stage_scope !== 'stage_1') {
      throw AppError.forbidden('Judge is not scoped for Stage 1');
    }

    const submission = await this.getSubmissionWithDepartment(submissionId, 1);
    const submissionDepartment = submission.teams?.department;
    if (!submissionDepartment) throw AppError.notFound('Submission team could not be resolved');
    if (submissionDepartment !== department) {
      throw AppError.validation('Submission does not belong to the requested department');
    }
    if (!judge.assigned_departments.includes(submissionDepartment)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    return this.upsertJudgeScore(submissionId, judgeId, {
      scores: {},
      comments: comments ? { note: comments } : {},
      total_score: null,
      is_representative_pick: true,
    });
  }

  async submitStage2Score(
    judgeId: string,
    submissionId: string,
    scores: Record<string, number>,
    comments: Record<string, string>,
  ) {
    const judge = await platformReadService.getJudgeById(judgeId);
    if (judge.stage_scope !== 'stage_2') {
      throw AppError.forbidden('Judge is not scoped for Stage 2');
    }

    const submission = await this.getSubmissionWithDepartment(submissionId, 2);
    const department = submission.teams?.department;
    if (!department) throw AppError.notFound('Submission team could not be resolved');
    if (!judge.assigned_departments.includes(department)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    const numericValues = Object.values(scores);
    const totalScore =
      numericValues.length > 0
        ? Number((numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length).toFixed(2))
        : null;

    return this.upsertJudgeScore(submissionId, judgeId, {
      scores,
      comments,
      total_score: totalScore,
      is_representative_pick: false,
    });
  }

  async createSubmissionFileDownloadUrl(judgeId: string, submissionId: string, fileId: string) {
    const judge = await platformReadService.getJudgeById(judgeId);
    const stage = judge.stage_scope === 'stage_1' ? 1 : 2;
    const submission = await this.getSubmissionWithDepartment(submissionId, stage);
    const department = submission.teams?.department;
    if (!department) throw AppError.notFound('Submission team could not be resolved');
    if (!judge.assigned_departments.includes(department)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    const files = this.getStoredFiles(submission.files);
    const file = files.find((item) => item.id === fileId || item.url === fileId);
    if (!file?.url) throw AppError.notFound('Submission file not found');

    const { data, error } = await this.supabase.storage
      .from(SUBMISSION_BUCKET)
      .createSignedUrl(file.url, 300, { download: file.filename ?? 'submission-file' });

    if (error) throw error;
    return {
      url: data.signedUrl,
      filename: file.filename ?? 'submission-file',
      expiresInSeconds: 300,
    };
  }

  private async getSubmissionWithDepartment(
    submissionId: string,
    stage: 1 | 2,
  ): Promise<SubmissionWithDepartment> {
    const { data, error } = await this.supabase
      .from('submissions')
      .select('*, teams!inner(id,department)')
      .eq('id', submissionId)
      .eq('stage', stage)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw AppError.notFound(`Stage ${stage} submission not found`);
    }
    const submission = data as SubmissionWithDepartment;
    if (this.isExcludedTeamSubmission(submission)) {
      throw AppError.notFound(`Stage ${stage} submission not found`);
    }
    return submission;
  }

  private isExcludedTeamSubmission(submission: SubmissionWithDepartment) {
    const teamId = submission.teams?.id;
    return Boolean(teamId && JUDGE_EXCLUDED_TEAM_IDS.has(teamId));
  }

  private getStoredFiles(files: unknown): StoredSubmissionFile[] {
    if (!Array.isArray(files)) return [];
    return files.filter((file): file is StoredSubmissionFile => {
      if (!file || typeof file !== 'object') return false;
      return 'url' in file || 'id' in file;
    });
  }

  private async upsertJudgeScore(
    submissionId: string,
    judgeId: string,
    payload: {
      scores: Record<string, number>;
      comments: Record<string, string> | { note?: string };
      total_score: number | null;
      is_representative_pick: boolean;
    },
  ) {
    const { data: existingScore, error: existingScoreError } = await this.supabase
      .from('judge_scores')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('judge_id', judgeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingScoreError) throw existingScoreError;

    const scorePayload = {
      submission_id: submissionId,
      judge_id: judgeId,
      scores: payload.scores,
      comments: payload.comments,
      total_score: payload.total_score,
      is_representative_pick: payload.is_representative_pick,
      submitted_at: new Date().toISOString(),
    };

    const mutation = existingScore
      ? this.supabase
          .from('judge_scores')
          .update(scorePayload as never)
          .eq('id', (existingScore as { id: string }).id)
      : this.supabase.from('judge_scores').insert([scorePayload] as never[]);

    const { data, error } = await mutation.select('*').single();
    if (error) throw error;
    return data;
  }
}

export const judgeApplicationService = new JudgeApplicationService();
