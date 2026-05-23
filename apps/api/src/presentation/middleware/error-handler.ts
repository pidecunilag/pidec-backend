import { ZodError } from 'zod';
import { type ErrorRequestHandler, type RequestHandler } from 'express';
import { ERROR_CODES, ERROR_HTTP_STATUS, type ApiError } from '@pidec/shared';
import { AppError } from '../../shared/errors/app-error.js';
import { mapDatabaseError } from '../../shared/errors/database-error.js';
import { logger } from '../../shared/logger/index.js';
import { isProd } from '../../shared/config/env.js';

/**
 * Express global error handler. Maps domain errors → standard ApiResponse
 * envelope. Stack traces are logged but never returned to the client in
 * production.
 */
// Express only treats this as an error middleware when all 4 parameters exist.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Already-handled response
  if (res.headersSent) return;

  // ── Zod validation error ────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const body: ApiError = {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request data',
        details: err.flatten(),
      },
    };
    res.status(ERROR_HTTP_STATUS.VALIDATION_ERROR).json(body);
    return;
  }

  // ── AppError ────────────────────────────────────────────────────────────
  if (err instanceof AppError) {
    const body: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unknown error ───────────────────────────────────────────────────────
  const databaseError = mapDatabaseError(err);
  if (databaseError) {
    const body: ApiError = {
      success: false,
      error: {
        code: databaseError.code,
        message: databaseError.message,
        ...(databaseError.details !== undefined ? { details: databaseError.details } : {}),
      },
    };
    res.status(databaseError.statusCode).json(body);
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  const body: ApiError = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: isProd ? 'Internal server error' : (err as Error)?.message ?? 'Internal server error',
    },
  };
  res.status(500).json(body);
};

/** 404 handler for unmatched routes. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiError = {
    success: false,
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Route not found' },
  };
  res.status(404).json(body);
};
