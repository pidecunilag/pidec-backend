import { z } from 'zod';
import { SUBMISSION_TOKEN_REGEX } from '../constants/regex.js';

/** Cheap, deterministic word count: collapse whitespace, split on space. */
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};

export const Stage1FormDataSchema = z.object({
  submission_type: z.literal('document_upload').default('document_upload'),
});

export type Stage1FormData = z.infer<typeof Stage1FormDataSchema>;

export const SubmissionTokenSchema = z
  .string()
  .trim()
  .regex(SUBMISSION_TOKEN_REGEX, 'Invalid submission token format');

export const Stage1SubmitSchema = z.object({
  token: SubmissionTokenSchema,
  formData: Stage1FormDataSchema.default({ submission_type: 'document_upload' }),
  fileIds: z.array(z.string()).min(1, 'Upload your Stage 1 proposal document').max(1, 'Upload only one Stage 1 proposal document'),
});

export type Stage1SubmitInput = z.infer<typeof Stage1SubmitSchema>;

// ── Stage 2 ─────────────────────────────────────────────────────────────────
const VideoLinkSchema = z
  .string()
  .trim()
  .url('Provide a full URL (https://...)')
  .refine(
    (v) => /youtube\.com|youtu\.be|drive\.google\.com/i.test(v),
    'Video link must be a YouTube (Unlisted) or Google Drive (Anyone with link, Viewer) URL',
  );

export const FileReferenceSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(255),
  size_bytes: z.number().int().positive(),
  mimetype: z.string().min(1).max(127),
  uploaded_at: z.string().datetime(),
});

export type FileReference = z.infer<typeof FileReferenceSchema>;

export const Stage2FormDataSchema = z.object({
  design_summary: z.string().trim().min(1, 'Design summary is required').max(20_000),
  engineering_decisions: z.string().trim().min(1).max(20_000),
  constraints_addressed: z.string().trim().min(1).max(20_000),
  testing_results: z.string().trim().min(1).max(20_000),
});

export const Stage2SubmitSchema = z.object({
  videoLink: VideoLinkSchema,
  formData: Stage2FormDataSchema,
  fileIds: z.array(z.string()).max(20).default([]),
});

export type Stage2SubmitInput = z.infer<typeof Stage2SubmitSchema>;

// ── Stage 3 ─────────────────────────────────────────────────────────────────
export const Stage3FormDataSchema = z.object({
  final_documentation_summary: z.string().trim().min(1).max(20_000),
  team_ready: z.literal(true, {
    errorMap: () => ({ message: 'Confirm team readiness before submitting' }),
  }),
});

export const Stage3SubmitSchema = z.object({
  formData: Stage3FormDataSchema,
  fileIds: z.array(z.string()).min(1, 'Upload at least one final document').max(10),
});

export type Stage3SubmitInput = z.infer<typeof Stage3SubmitSchema>;
