import { type RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import { judgeApplicationService } from '../../application/judge/judge-application-service.js';

export const getJudgeInfo: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const data = await judgeApplicationService.getJudgeInfo(req.user.id);
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
};

export const listJudgeSubmissions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const requestedStage = Number((req.query as { stage?: string }).stage ?? 1);
    const submissions = await judgeApplicationService.listJudgeSubmissions(req.user.id, requestedStage);
    res.status(200).json({ status: 'success', data: { submissions } });
  } catch (err) {
    next(err);
  }
};

export const pickStage1Representative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { submissionId, comments } = req.body as { submissionId: string; comments?: string };
    const { assigned_departments } = await judgeApplicationService.getJudgeInfo(req.user.id).then((data) => data.judge);
    const department = assigned_departments[0];
    if (!department) throw AppError.forbidden('Judge does not have an assigned department');
    const score = await judgeApplicationService.pickDepartmentRepresentative(
      req.user.id,
      department,
      submissionId,
      comments,
    );
    res.status(200).json({ status: 'success', data: { score } });
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

    const score = await judgeApplicationService.pickDepartmentRepresentative(
      req.user.id,
      deptId,
      submissionId,
      comments,
    );
    res.status(200).json({ status: 'success', data: { score } });
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
    const score = await judgeApplicationService.submitStage2Score(
      req.user.id,
      submissionId,
      scores,
      comments,
    );
    res.status(200).json({ status: 'success', data: { score } });
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
