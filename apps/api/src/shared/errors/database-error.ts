import { ERROR_CODES } from '@pidec/shared';
import { AppError } from './app-error.js';

type DatabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

const readText = (value: unknown): string => (typeof value === 'string' ? value : '');

const readDatabaseErrorText = (err: DatabaseErrorLike): string =>
  `${readText(err.message)} ${readText(err.details)}`.toLowerCase();

export const mapDatabaseError = (err: unknown): AppError | null => {
  if (!err || typeof err !== 'object') return null;

  const databaseError = err as DatabaseErrorLike;
  if (databaseError.code !== '23505') return null;

  const text = readDatabaseErrorText(databaseError);

  if (text.includes('idx_users_matric_unique') || text.includes('matric_number')) {
    return new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'This matric number is already registered.', {
      field: 'matricNumber',
    });
  }

  if (text.includes('idx_users_email_unique') || text.includes('(email)')) {
    return new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'This email is already registered.', {
      field: 'email',
    });
  }

  return new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'This record already exists.');
};
