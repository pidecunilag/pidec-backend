import { z } from 'zod';
import { DEPARTMENTS } from '../constants/departments.js';
import {
  MATRIC_REGEX,
  PASSWORD_HAS_LETTER_REGEX,
  PASSWORD_HAS_NUMBER_REGEX,
  PASSWORD_MIN_LENGTH,
  stripMatricSeparators,
} from '../constants/regex.js';
import { EmailSchema } from './common.js';

const STUDENT_LEVELS = [100, 200, 300, 400, 500] as const;

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password is too long')
  .refine((v) => PASSWORD_HAS_LETTER_REGEX.test(v), {
    message: 'Password must contain at least one letter',
  })
  .refine((v) => PASSWORD_HAS_NUMBER_REGEX.test(v), {
    message: 'Password must contain at least one number',
  });

export const MatricSchema = z
  .string()
  .trim()
  .transform((raw) => stripMatricSeparators(raw))
  .pipe(
    z.string().regex(MATRIC_REGEX, {
      message:
        'Matric number must be 9 digits, start with admission year (19–25), and have faculty code 04 (Engineering)',
    }),
  );

export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Full name is required')
    .max(120, 'Name is too long')
    .refine((v) => /\s/.test(v), { message: 'Enter your full legal name (first and last)' }),
  email: EmailSchema,
  password: PasswordSchema,
  matricNumber: MatricSchema,
  department: z.enum(DEPARTMENTS),
  level: z.coerce
    .number()
    .refine(
      (n): n is (typeof STUDENT_LEVELS)[number] =>
        (STUDENT_LEVELS as readonly number[]).includes(n),
      { message: 'Select a valid level (100–500)' },
    ),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSessionSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export type RefreshSessionInput = z.infer<typeof RefreshSessionSchema>;

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export type LogoutInput = z.infer<typeof LogoutSchema>;

export const ReuploadDocSchema = z.object({
  // The file itself is validated separately (multipart upload). This schema
  // covers any sidecar fields submitted with the re-upload.
});

export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

export const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordSchema,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;
