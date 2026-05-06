import { type RequestHandler } from 'express';
import { Stage1SubmitSchema, Stage2SubmitSchema, Stage3SubmitSchema } from '@pidec/shared';
import { AppError } from '../../shared/errors/app-error.js';
import { submissionApplicationService } from '../../application/submission/submission-application-service.js';

export const listMySubmissions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const submissions = await submissionApplicationService.listMySubmissions(req.user.id);
    res.status(200).json({ status: 'success', data: { submissions } });
  } catch (err) {
    next(err);
  }
};

export const submitStage1: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const result = await submissionApplicationService.submitStage1(
      req.user.id,
      req.body as ReturnType<typeof Stage1SubmitSchema.parse>,
    );
    res.status(result.duplicated ? 200 : 201).json({
      status: 'success',
      data: { submission: result.submission, duplicated: result.duplicated },
    });
  } catch (err) {
    next(err);
  }
};

export const submitStage2: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const result = await submissionApplicationService.submitStage2(
      req.user.id,
      req.body as ReturnType<typeof Stage2SubmitSchema.parse>,
    );
    res.status(result.duplicated ? 200 : 201).json({
      status: 'success',
      data: { submission: result.submission, duplicated: result.duplicated },
    });
  } catch (err) {
    next(err);
  }
};

export const submitStage3: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const result = await submissionApplicationService.submitStage3(
      req.user.id,
      req.body as ReturnType<typeof Stage3SubmitSchema.parse>,
    );
    res.status(result.duplicated ? 200 : 201).json({
      status: 'success',
      data: { submission: result.submission, duplicated: result.duplicated },
    });
  } catch (err) {
    next(err);
  }
};

export const submitCurrentStage: RequestHandler = async (req, res, next) => {
  try {
    const activeStage = await submissionApplicationService.getCurrentStage();

    if (activeStage === 1) {
      req.body = Stage1SubmitSchema.parse(req.body);
      return submitStage1(req, res, next);
    }

    if (activeStage === 2) {
      req.body = Stage2SubmitSchema.parse(req.body);
      return submitStage2(req, res, next);
    }

    req.body = Stage3SubmitSchema.parse(req.body);
    return submitStage3(req, res, next);
  } catch (err) {
    next(err);
  }
};
