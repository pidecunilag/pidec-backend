import { logger } from '../../shared/logger/index.js';

type AsyncTask = Promise<unknown>;

export const fireAndForget = (task: AsyncTask, context: string): void => {
  void task.catch((error: unknown) => {
    logger.error({ err: error, context }, 'Asynchronous email dispatch failed');
  });
};
