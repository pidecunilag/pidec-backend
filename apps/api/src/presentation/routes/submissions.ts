import { Router } from 'express';
import { Stage1SubmitSchema, Stage2SubmitSchema, Stage3SubmitSchema } from '@pidec/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listMySubmissions,
  submitCurrentStage,
  submitStage1,
  submitStage2,
  submitStage3,
  uploadSubmissionFile,
} from '../controllers/submission-controller.js';
import { getSubmissionFeedback } from '../controllers/feedback-controller.js';
import { UuidSchema } from '@pidec/shared';
import { z } from 'zod';
import { parseSubmissionFileUpload } from '../middleware/upload.js';

const submissionRouter = Router();

submissionRouter.use(requireAuth, requireRole('student'));

submissionRouter.get('/me', listMySubmissions);
submissionRouter.get('/my', listMySubmissions);
submissionRouter.post('/files', parseSubmissionFileUpload, uploadSubmissionFile);
submissionRouter.post('/', submitCurrentStage);
submissionRouter.post('/stage-1', validate(Stage1SubmitSchema), submitStage1);
submissionRouter.post('/stage-2', validate(Stage2SubmitSchema), submitStage2);
submissionRouter.post('/stage-3', validate(Stage3SubmitSchema), submitStage3);
submissionRouter.get('/:id/feedback', validate(z.object({ id: UuidSchema }), 'params'), getSubmissionFeedback);

export { submissionRouter };
