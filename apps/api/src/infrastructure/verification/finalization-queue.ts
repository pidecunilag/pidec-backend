import Redis from 'ioredis';
import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';
import type { VerificationJobPayload } from './queue.js';

export interface VerificationFinalizationJobPayload extends VerificationJobPayload {
  firstMethod: 'groq' | 'gemini' | 'manual';
  firstReason?: string;
}

type Processor = (payload: VerificationFinalizationJobPayload) => Promise<void>;

export class VerificationFinalizationQueue {
  private readonly queueName = 'verification-finalization-jobs';
  private readonly connection: Redis | null;
  private readonly queue: Queue<VerificationFinalizationJobPayload> | null;
  private worker: Worker<VerificationFinalizationJobPayload> | null = null;
  private processor: Processor | null = null;

  constructor() {
    if (env.REDIS_URL) {
      try {
        this.connection = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
        });
        this.queue = new Queue<VerificationFinalizationJobPayload>(this.queueName, {
          connection: this.connection,
        });
      } catch (err) {
        logger.warn(
          { err },
          'Failed to initialize verification finalization queue; finalization will run inline',
        );
        this.connection = null;
        this.queue = null;
      }
    } else {
      this.connection = null;
      this.queue = null;
    }
  }

  registerProcessor(processor: Processor): void {
    this.processor = processor;
    if (!this.connection || !this.queue || this.worker) return;

    this.worker = new Worker<VerificationFinalizationJobPayload>(
      this.queueName,
      async (job: Job<VerificationFinalizationJobPayload>) => {
        if (!this.processor) return;
        await this.processor(job.data);
      },
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('error', (err) => {
      logger.error({ err }, 'Verification finalization worker error');
    });
  }

  async enqueue(payload: VerificationFinalizationJobPayload): Promise<void> {
    if (this.queue) {
      try {
        if (this.connection?.status === 'wait') await this.connection.connect();
        await this.queue.add('finalize-verification', payload, {
          attempts: 2,
          removeOnComplete: 100,
          removeOnFail: 100,
          backoff: { type: 'exponential', delay: 1_000 },
        });
        return;
      } catch (err) {
        logger.warn(
          { err },
          'Verification finalization enqueue failed; falling back to inline processing',
        );
      }
    }

    if (this.processor) {
      setImmediate(() => {
        this.processor?.(payload).catch((err) => {
          logger.error({ err, payload }, 'Inline verification finalization failed');
        });
      });
    }
  }
}

let cachedQueue: VerificationFinalizationQueue | null = null;
export const getVerificationFinalizationQueue = (): VerificationFinalizationQueue => {
  if (cachedQueue) return cachedQueue;
  cachedQueue = new VerificationFinalizationQueue();
  return cachedQueue;
};
