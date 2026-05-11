import { Router } from 'express';
import { z } from 'zod';
import { Stage1RepresentativeSelectionSchema, Stage2ScoreSchema, UuidSchema } from '@pidec/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getSubmissionFileDownload,
  getJudgeInfo,
  listJudgeSubmissions,
  pickDepartmentRepresentative,
  pickStage1Representative,
  submitSubmissionScore,
  submitStage2Score,
} from '../controllers/judge-controller.js';

const JudgeSubmissionQuerySchema = z.object({
  stage: z.coerce.number().int().min(1).max(3).optional(),
});

const Stage2ScoreWithSubmissionSchema = Stage2ScoreSchema.extend({
  submissionId: UuidSchema,
});

const judgeRouter = Router();

judgeRouter.use(requireAuth, requireRole('judge'));

judgeRouter.get('/me', getJudgeInfo);
judgeRouter.get(
  '/submissions',
  validate(JudgeSubmissionQuerySchema, 'query'),
  listJudgeSubmissions,
);
judgeRouter.get(
  '/submissions/:submissionId/files/:fileId/download',
  validate(z.object({ submissionId: UuidSchema, fileId: z.string().min(1) }), 'params'),
  getSubmissionFileDownload,
);
judgeRouter.post(
  '/stage-1/representative',
  validate(Stage1RepresentativeSelectionSchema),
  pickStage1Representative,
);
judgeRouter.post('/stage-2/score', validate(Stage2ScoreWithSubmissionSchema), submitStage2Score);
judgeRouter.post(
  '/scores/:submissionId',
  validate(z.object({ submissionId: UuidSchema }), 'params'),
  validate(Stage2ScoreSchema),
  submitSubmissionScore,
);
judgeRouter.post(
  '/selections/:deptId',
  validate(z.object({ deptId: z.string().min(1) }), 'params'),
  validate(z.object({ submissionId: UuidSchema, comments: z.string().trim().max(5000).optional() })),
  pickDepartmentRepresentative,
);

export { judgeRouter };
