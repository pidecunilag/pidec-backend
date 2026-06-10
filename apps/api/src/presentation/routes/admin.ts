import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  SetActiveStageSchema,
  ToggleSchema,
  UpdateEditionSchema,
  VerificationDecisionSchema,
  SuspendUserSchema,
  TeamStageActionSchema,
  GenerateTokenSchema,
  CreateJudgeSchema,
  EnterFeedbackSchema,
  PublishFeedbackSchema,
  AdminUsersQuerySchema,
  AdminTeamsQuerySchema,
  AdminSubmissionsQuerySchema,
  AdminJudgesQuerySchema,
  AdminAnalyticsQuerySchema,
  ListTokensQuerySchema,
  RegenerateTokenSchema,
  AdminVerificationQueueQuerySchema,
  Stage2CheckpointListQuerySchema,
  CreateStage2CheckpointSchema,
  UpdateStage2CheckpointSchema,
  AdminExportSubmissionsQuerySchema,
  CreateLandingAssetSchema,
  UpdateLandingAssetSchema,
  CreateLandingFaqSchema,
  UpdateLandingFaqSchema,
  UuidSchema,
} from '@pidec/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getOverview,
  getAnalytics,
  updateEdition,
  setActiveStage,
  toggleSignup,
  toggleSubmissionWindow,
  toggleTeamLock,
  listUsers,
  listTeams,
  listSubmissions,
  getSubmissionFileDownload,
  listJudges,
  listVerificationQueue,
  listStage2Checkpoints,
  createStage2Checkpoint,
  updateStage2Checkpoint,
  deleteStage2Checkpoint,
  verificationDecision,
  suspendUser,
  unsuspendUser,
  applyTeamAction,
  listTokens,
  generateDepartmentToken,
  regenerateDepartmentToken,
  createJudge,
  deactivateJudge,
  enterFeedback,
  publishFeedback,
  launchStage1ResultsFromAdmin,
  exportStudents,
  exportTeams,
  exportSubmissions,
  exportScores,
} from '../controllers/admin-controller.js';
import {
  listSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} from '../controllers/landing-content-controller.js';

const UserParamsSchema = z.object({ userId: UuidSchema });
const TeamParamsSchema = z.object({ teamId: UuidSchema });
const JudgeParamsSchema = z.object({ judgeId: UuidSchema });
const SubmissionParamsSchema = z.object({ submissionId: UuidSchema });
const SubmissionFileParamsSchema = z.object({
  submissionId: UuidSchema,
  fileId: z.string().min(1),
});
const StudentParamsSchema = z.object({ userId: UuidSchema });
const LaunchStage1ResultsSchema = z.object({
  password: z.string().min(1, 'Admin password is required'),
});

const forceStudentRole: RequestHandler = (req, _res, next) => {
  req.query = { ...req.query, role: 'student' };
  next();
};

const forceFlaggedVerificationStatus: RequestHandler = (req, _res, next) => {
  req.query = { ...req.query, status: 'flagged' };
  next();
};

const publishSingleFeedback: RequestHandler = (req, res, next) => {
  req.body = { submissionIds: [(req.params as { submissionId: string }).submissionId] };
  return publishFeedback(req, res, next);
};

const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/overview', getOverview);
adminRouter.get('/analytics', validate(AdminAnalyticsQuerySchema, 'query'), getAnalytics);
adminRouter.get(
  '/verifications/flagged',
  forceFlaggedVerificationStatus,
  validate(AdminVerificationQueueQuerySchema, 'query'),
  listVerificationQueue,
);
adminRouter.patch(
  '/verifications/:userId',
  validate(UserParamsSchema, 'params'),
  validate(VerificationDecisionSchema),
  verificationDecision,
);
adminRouter.get('/students', forceStudentRole, validate(AdminUsersQuerySchema, 'query'), listUsers);
adminRouter.patch(
  '/students/:userId/suspend',
  validate(StudentParamsSchema, 'params'),
  validate(SuspendUserSchema),
  suspendUser,
);
adminRouter.patch(
  '/teams/:teamId/stage',
  validate(TeamParamsSchema, 'params'),
  validate(TeamStageActionSchema),
  applyTeamAction,
);
adminRouter.post('/tokens', validate(GenerateTokenSchema), generateDepartmentToken);
adminRouter.patch('/settings/edition', validate(UpdateEditionSchema), updateEdition);
adminRouter.patch(
  '/feedback/:submissionId/publish',
  validate(SubmissionParamsSchema, 'params'),
  publishSingleFeedback,
);
adminRouter.patch('/edition', validate(UpdateEditionSchema), updateEdition);
adminRouter.post('/stage', validate(SetActiveStageSchema), setActiveStage);
adminRouter.post('/signup', validate(ToggleSchema), toggleSignup);
adminRouter.post('/submission-window', validate(ToggleSchema), toggleSubmissionWindow);
adminRouter.post('/team-lock', validate(ToggleSchema), toggleTeamLock);
adminRouter.get('/users', validate(AdminUsersQuerySchema, 'query'), listUsers);
adminRouter.get('/verification-queue', validate(AdminVerificationQueueQuerySchema, 'query'), listVerificationQueue);
adminRouter.get('/checkpoints', validate(Stage2CheckpointListQuerySchema, 'query'), listStage2Checkpoints);
adminRouter.get('/teams', validate(AdminTeamsQuerySchema, 'query'), listTeams);
adminRouter.get('/submissions', validate(AdminSubmissionsQuerySchema, 'query'), listSubmissions);
adminRouter.get(
  '/submissions/:submissionId/files/:fileId/download',
  validate(SubmissionFileParamsSchema, 'params'),
  getSubmissionFileDownload,
);
adminRouter.get('/judges', validate(AdminJudgesQuerySchema, 'query'), listJudges);

adminRouter.post(
  '/users/:userId/verification',
  validate(UserParamsSchema, 'params'),
  validate(VerificationDecisionSchema),
  verificationDecision,
);
adminRouter.post(
  '/users/:userId/suspend',
  validate(UserParamsSchema, 'params'),
  validate(SuspendUserSchema),
  suspendUser,
);
adminRouter.post('/users/:userId/unsuspend', validate(UserParamsSchema, 'params'), unsuspendUser);

adminRouter.post(
  '/teams/:teamId/action',
  validate(TeamParamsSchema, 'params'),
  validate(TeamStageActionSchema),
  applyTeamAction,
);
adminRouter.get('/tokens', validate(ListTokensQuerySchema, 'query'), listTokens);
adminRouter.post('/tokens/generate', validate(GenerateTokenSchema), generateDepartmentToken);
adminRouter.post('/tokens/regenerate', validate(RegenerateTokenSchema), regenerateDepartmentToken);

adminRouter.get('/export/students', exportStudents);
adminRouter.get('/export/teams', exportTeams);
adminRouter.get('/export/submissions', validate(AdminExportSubmissionsQuerySchema, 'query'), exportSubmissions);
adminRouter.get('/export/scores', exportScores);

adminRouter.get('/content/sponsors', listSponsors);
adminRouter.post('/content/sponsors', validate(CreateLandingAssetSchema), createSponsor);
adminRouter.patch('/content/sponsors/:sponsorId', validate(z.object({ sponsorId: UuidSchema }), 'params'), validate(UpdateLandingAssetSchema), updateSponsor);
adminRouter.delete('/content/sponsors/:sponsorId', validate(z.object({ sponsorId: UuidSchema }), 'params'), deleteSponsor);

adminRouter.get('/content/partners', listPartners);
adminRouter.post('/content/partners', validate(CreateLandingAssetSchema), createPartner);
adminRouter.patch('/content/partners/:partnerId', validate(z.object({ partnerId: UuidSchema }), 'params'), validate(UpdateLandingAssetSchema), updatePartner);
adminRouter.delete('/content/partners/:partnerId', validate(z.object({ partnerId: UuidSchema }), 'params'), deletePartner);

adminRouter.get('/content/faqs', listFaqs);
adminRouter.post('/content/faqs', validate(CreateLandingFaqSchema), createFaq);
adminRouter.patch('/content/faqs/:faqId', validate(z.object({ faqId: UuidSchema }), 'params'), validate(UpdateLandingFaqSchema), updateFaq);
adminRouter.delete('/content/faqs/:faqId', validate(z.object({ faqId: UuidSchema }), 'params'), deleteFaq);

adminRouter.post('/checkpoints', validate(CreateStage2CheckpointSchema), createStage2Checkpoint);
adminRouter.patch(
  '/checkpoints/:checkpointId',
  validate(z.object({ checkpointId: UuidSchema }), 'params'),
  validate(UpdateStage2CheckpointSchema),
  updateStage2Checkpoint,
);
adminRouter.delete(
  '/checkpoints/:checkpointId',
  validate(z.object({ checkpointId: UuidSchema }), 'params'),
  deleteStage2Checkpoint,
);

adminRouter.post('/judges', validate(CreateJudgeSchema), createJudge);
adminRouter.post(
  '/judges/:judgeId/deactivate',
  validate(JudgeParamsSchema, 'params'),
  deactivateJudge,
);

adminRouter.post(
  '/feedback/:submissionId',
  validate(SubmissionParamsSchema, 'params'),
  validate(EnterFeedbackSchema),
  enterFeedback,
);
adminRouter.post('/feedback/publish', validate(PublishFeedbackSchema), publishFeedback);
adminRouter.post('/stage1-results/launch', validate(LaunchStage1ResultsSchema), launchStage1ResultsFromAdmin);

export { adminRouter };
