import { z } from 'zod';
import { DEPARTMENTS } from '../constants/departments.js';
import { JUDGE_STAGE_SCOPES } from '../constants/roles.js';
import { UuidSchema, EmailSchema } from './common.js';

export const SetActiveStageSchema = z.object({
  stage: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export const ToggleSchema = z.object({
  open: z.boolean(),
});

export const UpdateEditionSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  theme: z.string().trim().min(1).max(200).optional(),
  announcementBanner: z.string().trim().max(500).nullable().optional(),
});

export const VerificationDecisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approve'),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    decision: z.literal('reject'),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
  }),
  z.object({
    decision: z.literal('request_resubmission'),
    note: z.string().trim().max(500).optional(),
  }),
]);

export const SuspendUserSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export const TeamStageActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('advance') }),
  z.object({
    action: z.literal('disqualify'),
    reason: z.string().trim().min(1).max(500),
    atStage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({ action: z.literal('unlock_submission') }),
]);

export const GenerateTokenSchema = z.object({
  department: z.enum(DEPARTMENTS),
  expiresAt: z.string().datetime().optional(),
});

export const CreateJudgeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: EmailSchema,
  stageScope: z.enum(JUDGE_STAGE_SCOPES),
  assignedDepartments: z.array(z.enum(DEPARTMENTS)).min(1, 'Assign at least one department'),
});

export const EnterFeedbackSchema = z.object({
  scores: z.record(z.string(), z.number().min(0).max(100)),
  comments: z.record(z.string(), z.string().max(2000)),
  totalScore: z.number().min(0).max(100),
  outcome: z.enum(['advanced', 'not_advanced', 'pending']),
  evaluatorName: z.string().trim().min(1).max(120),
  evaluationDate: z.string().date().optional(),
});

export const PublishFeedbackSchema = z.object({
  submissionIds: z.array(UuidSchema).min(1, 'Select at least one submission'),
});

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(['student', 'admin', 'judge']).optional(),
  verificationStatus: z
    .enum(['pending', 'verified', 'rejected', 'flagged', 'suspended'])
    .optional(),
  department: z.enum(DEPARTMENTS).optional(),
  hasTeam: z.coerce.boolean().optional(),
  isSuspended: z.coerce.boolean().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const AdminTeamsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  status: z.enum(['active', 'disqualified', 'under_review']).optional(),
  currentStage: z.coerce.number().int().min(1).max(3).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const AdminSubmissionsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  stage: z.coerce.number().int().min(1).max(3).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  teamId: UuidSchema.optional(),
  status: z.enum(['submitted', 'under_review', 'feedback_published']).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const AdminJudgesQuerySchema = z.object({
  stageScope: z.enum(JUDGE_STAGE_SCOPES).optional(),
  isActive: z.coerce.boolean().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const ListTokensQuerySchema = z.object({
  department: z.enum(DEPARTMENTS).optional(),
  includeRetired: z.coerce.boolean().optional().default(false),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const RegenerateTokenSchema = GenerateTokenSchema;

export const AdminVerificationQueueQuerySchema = z.object({
  status: z.enum(['pending', 'flagged']).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

export const AdminAnalyticsQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    stage: z.coerce.number().int().min(1).max(3).optional(),
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
    {
      message: 'startDate cannot be after endDate',
      path: ['startDate'],
    },
  );

export const Stage2CheckpointSchema = z.object({
  id: UuidSchema,
  editionId: UuidSchema,
  stage: z.literal(2),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullable(),
  dueAt: z.string().datetime().nullable(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type Stage2CheckpointDto = z.infer<typeof Stage2CheckpointSchema>;

export const CreateStage2CheckpointSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(5000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const UpdateStage2CheckpointSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const Stage2CheckpointListQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export const AdminExportSubmissionsQuerySchema = z.object({
  stage: z.coerce.number().int().min(1).max(3).optional(),
});

export const LandingAssetSchema = z.object({
  id: UuidSchema,
  editionId: UuidSchema,
  name: z.string().trim().min(1).max(120),
  logoUrl: z.string().url(),
  websiteUrl: z.string().url().nullable(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export const CreateLandingAssetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  logoUrl: z.string().url(),
  websiteUrl: z.string().url().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const UpdateLandingAssetSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const LandingFaqSchema = z.object({
  id: UuidSchema,
  editionId: UuidSchema,
  question: z.string().trim().min(1).max(250),
  answer: z.string().trim().min(1).max(5000),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export const CreateLandingFaqSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(250),
  answer: z.string().trim().min(1, 'Answer is required').max(5000),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const UpdateLandingFaqSchema = z.object({
  question: z.string().trim().min(1).max(250).optional(),
  answer: z.string().trim().min(1).max(5000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});
