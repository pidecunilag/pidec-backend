import { z } from 'zod';
import { EmailSchema, UuidSchema } from './common.js';

export const CreateFinaleRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: EmailSchema,
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(24, 'Enter a valid phone number')
    .regex(/^\+?[0-9 ()-]+$/, 'Enter a valid phone number'),
});

export const LookupFinaleCardSchema = z.object({
  email: EmailSchema,
});

export const AdminFinaleRegistrationsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'admitted', 'awaiting']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const FinaleAdmissionSchema = z.object({
  admitted: z.boolean(),
});

export const FinaleRegistrationParamsSchema = z.object({
  registrationId: UuidSchema,
});

export type CreateFinaleRegistrationInput = z.infer<typeof CreateFinaleRegistrationSchema>;
export type LookupFinaleCardInput = z.infer<typeof LookupFinaleCardSchema>;
export type AdminFinaleRegistrationsQuery = z.infer<typeof AdminFinaleRegistrationsQuerySchema>;
