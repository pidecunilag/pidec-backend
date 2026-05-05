import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import {
  corsMiddleware,
  originCheckMiddleware,
  securityHeaders,
} from './presentation/middleware/security.js';
import { errorHandler, notFoundHandler } from './presentation/middleware/error-handler.js';
import { globalRateLimiter } from './presentation/middleware/rate-limit.js';
import { responseEnvelopeMiddleware } from './presentation/middleware/response-envelope.js';
import { v1Router } from './presentation/routes/index.js';
import { logger } from './shared/logger/index.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './presentation/docs/swagger.js';

/**
 * Build the Express app. Separated from server bootstrap so tests can
 * import `createApp()` without binding a port.
 */
export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Logging — auto-redacts sensitive fields per logger config
  app.use(pinoHttp({ logger, customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info') }));

  // Security
  app.use(securityHeaders);
  app.use(corsMiddleware);

  // Parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);
  app.use(originCheckMiddleware);
  app.use(responseEnvelopeMiddleware);

  app.get('/', (_req, res) => {
    res.status(200).json({
      status: 'success',
      data: {
        service: 'PIDEC API',
        version: 'v1',
        health: '/api/v1/health',
        docs: '/api-docs',
      },
    });
  });

  // API Documentation (Swagger)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'PIDEC API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // API
  app.use('/api/v1', v1Router);

  // 404 + error handler last
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
