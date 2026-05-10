import { createApp } from './app.js';
import { startSelfPing } from './infrastructure/keep-alive/self-ping.js';
import { env } from './shared/config/env.js';
import { logger } from './shared/logger/index.js';

const app = createApp();

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    { host: env.API_HOST, port: env.API_PORT, env: env.NODE_ENV },
    `PIDEC API listening on http://${env.API_HOST}:${env.API_PORT}`,
  );
  startSelfPing();
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  // Hard exit if cleanup hangs
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
