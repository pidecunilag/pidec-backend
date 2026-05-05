import { type RequestHandler } from 'express';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { AppError } from '../../shared/errors/app-error.js';

const getActiveEdition = async () => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('editions')
    .select('id,active_stage')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('No active edition configured');
  return data;
};

const getJudgeProfile = async (judgeId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('judges')
    .select('*')
    .eq('id', judgeId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.forbidden('Judge profile is not active');
  return data;
};

export const getJudgeInfo: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const edition = await getActiveEdition();
    const judge = await getJudgeProfile(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        judge,
        edition,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listJudgeSubmissions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const requestedStage = Number((req.query as { stage?: string }).stage ?? 1);
    const stage = requestedStage;
    if (![1, 2, 3].includes(stage)) throw AppError.validation('Invalid stage');

    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();
    const judge = await getJudgeProfile(req.user.id);
    const allowedStage = judge.stage_scope === 'stage_1' ? 1 : 2;
    if (stage !== allowedStage) {
      throw AppError.forbidden('Requested stage is outside judge scope');
    }
    if (edition.active_stage < allowedStage) {
      throw AppError.forbidden('Judge submissions are not available for this stage yet');
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(
        '*, teams!inner(id,name,department,status), users!submissions_submitted_by_fkey(id,name,email)',
      )
      .eq('edition_id', edition.id)
      .eq('stage', stage)
      .is('deleted_at', null)
      .in('teams.department', judge.assigned_departments)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { submissions: data ?? [] },
    });
  } catch (err) {
    next(err);
  }
};

export const pickStage1Representative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { submissionId, comments } = req.body as { submissionId: string; comments?: string };
    const supabase = getSupabaseService() as any;

    const judge = await getJudgeProfile(req.user.id);
    if (judge.stage_scope !== 'stage_1') {
      throw AppError.forbidden('Judge is not scoped for Stage 1');
    }

    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, teams!inner(id,department)')
      .eq('id', submissionId)
      .eq('stage', 1)
      .is('deleted_at', null)
      .maybeSingle();

    if (submissionError) throw submissionError;
    if (!submission) throw AppError.notFound('Stage 1 submission not found');

    const dept = (submission as unknown as { teams: { department: string } }).teams.department;
    if (!judge.assigned_departments.includes(dept)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    const { data: score, error } = await supabase
      .from('judge_scores')
      .upsert(
        [
          {
            submission_id: submissionId,
            judge_id: req.user.id,
            scores: {},
            comments: comments ? { note: comments } : {},
            is_representative_pick: true,
            submitted_at: new Date().toISOString(),
          },
        ] as never[],
        { onConflict: 'judge_id,submission_id' },
      )
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { score },
    });
  } catch (err) {
    next(err);
  }
};

export const pickDepartmentRepresentative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { deptId } = req.params as { deptId: string };
    const { submissionId, comments } = req.body as { submissionId?: string; comments?: string };
    if (!submissionId) throw AppError.validation('Submission id is required');

    const supabase = getSupabaseService() as any;
    const { data: submission, error } = await supabase
      .from('submissions')
      .select('id, teams!inner(department)')
      .eq('id', submissionId)
      .eq('stage', 1)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!submission) throw AppError.notFound('Stage 1 submission not found');

    const submissionDepartment = (submission as { teams: { department: string } }).teams.department;
    if (submissionDepartment !== deptId) {
      throw AppError.validation('Submission does not belong to the requested department');
    }

    req.body = { submissionId, comments };
    return pickStage1Representative(req, res, next);
  } catch (err) {
    next(err);
  }
};

export const submitStage2Score: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { submissionId, scores, comments } = req.body as {
      submissionId: string;
      scores: Record<string, number>;
      comments: Record<string, string>;
    };

    const supabase = getSupabaseService() as any;
    const judge = await getJudgeProfile(req.user.id);
    if (judge.stage_scope !== 'stage_2') {
      throw AppError.forbidden('Judge is not scoped for Stage 2');
    }

    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*, teams!inner(id,department)')
      .eq('id', submissionId)
      .eq('stage', 2)
      .is('deleted_at', null)
      .maybeSingle();

    if (submissionError) throw submissionError;
    if (!submission) throw AppError.notFound('Stage 2 submission not found');

    const dept = (submission as unknown as { teams: { department: string } }).teams.department;
    if (!judge.assigned_departments.includes(dept)) {
      throw AppError.forbidden('Submission is outside judge department scope');
    }

    const numericValues = Object.values(scores);
    const totalScore =
      numericValues.length > 0
        ? Number(
            (numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length).toFixed(
              2,
            ),
          )
        : null;

    const { data: score, error } = await supabase
      .from('judge_scores')
      .upsert(
        [
          {
            submission_id: submissionId,
            judge_id: req.user.id,
            scores,
            comments,
            total_score: totalScore,
            is_representative_pick: false,
            submitted_at: new Date().toISOString(),
          },
        ] as never[],
        { onConflict: 'judge_id,submission_id' },
      )
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { score },
    });
  } catch (err) {
    next(err);
  }
};

export const submitSubmissionScore: RequestHandler = async (req, res, next) => {
  req.body = {
    ...(req.body as Record<string, unknown>),
    submissionId: (req.params as { submissionId: string }).submissionId,
  };
  return submitStage2Score(req, res, next);
};
