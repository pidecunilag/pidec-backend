import { z } from 'zod';
import { UuidSchema } from './common.js';

export const Stage1ScoreCriteriaSchema = z.object({
  problem_statement_clarity: z.number().min(0).max(20),
  proposed_solution_quality: z.number().min(0).max(30),
  theme_alignment: z.number().min(0).max(20),
  feasibility_assessment: z.number().min(0).max(20),
  departmental_relevance: z.number().min(0).max(10),
});

export const Stage1ScoreCommentsSchema = z
  .object({
    problem_statement_clarity: z.string().trim().max(2000).optional(),
    proposed_solution_quality: z.string().trim().max(2000).optional(),
    theme_alignment: z.string().trim().max(2000).optional(),
    feasibility_assessment: z.string().trim().max(2000).optional(),
    departmental_relevance: z.string().trim().max(2000).optional(),
    overall: z.string().trim().max(5000).optional(),
  })
  .default({});

export const Stage1ScoreSchema = z.object({
  submissionId: UuidSchema,
  scores: Stage1ScoreCriteriaSchema,
  comments: Stage1ScoreCommentsSchema,
});

export type Stage1ScoreInput = z.infer<typeof Stage1ScoreSchema>;

/**
 * Legacy Stage 1 judge action kept for compatibility with earlier admin flows.
 * Judges now submit weighted rubric scores; admins make final representative decisions.
 */
export const Stage1RepresentativeSelectionSchema = z.object({
  submissionId: UuidSchema,
  comments: z.string().trim().max(5000).optional(),
});

export type Stage1RepresentativeSelectionInput = z.infer<
  typeof Stage1RepresentativeSelectionSchema
>;

/**
 * Stage 2 judge scoring. Criteria keys are flexible (rubric-driven) — the
 * application layer enforces "all rubric criteria must be present" by
 * comparing `Object.keys(scores)` against the active rubric.
 */
export const Stage2ScoreSchema = z.object({
  scores: z
    .record(z.string().min(1).max(60), z.number().min(0).max(100))
    .refine((rec) => Object.keys(rec).length >= 1, 'Score at least one criterion'),
  comments: z.record(z.string().min(1).max(60), z.string().trim().max(2000)),
});

export type Stage2ScoreInput = z.infer<typeof Stage2ScoreSchema>;
