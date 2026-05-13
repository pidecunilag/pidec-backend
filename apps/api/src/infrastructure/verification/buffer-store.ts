import Redis from 'ioredis';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';

type MemoryEntry = {
  value: Buffer;
  expiresAt: number;
};

/**
 * Short-lived buffer storage for verification files.
 *
 * Uses Redis when available and falls back to in-process memory in local
 * development so the endpoint remains functional without infrastructure.
 */
export class VerificationBufferStore {
  private redis: Redis | null = null;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor() {
    if (env.REDIS_URL) {
      try {
        this.redis = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        });
        this.redis.on('error', (err) => {
          logger.warn({ err }, 'Verification buffer store Redis error; falling back to memory store');
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to initialize Redis buffer store; using memory fallback');
        this.redis = null;
      }
    } else {
      this.redis = null;
    }
  }

  private async setMemory(key: string, value: Buffer, ttlSeconds: number): Promise<void> {
    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private async getMemory(key: string): Promise<Buffer | null> {
    const entry = this.memory.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: Buffer, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        await this.redis.set(key, value.toString('base64'), 'EX', ttlSeconds);
        return;
      } catch (err) {
        logger.warn({ err }, 'Redis set failed for verification buffer; using memory fallback');
      }
    }

    await this.setMemory(key, value, ttlSeconds);
  }

  async take(key: string): Promise<Buffer | null> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        const value = await this.redis.get(key);
        if (!value) return null;
        await this.redis.del(key);
        return Buffer.from(value, 'base64');
      } catch (err) {
        logger.warn({ err }, 'Redis take failed for verification buffer; using memory fallback');
      }
    }

    const value = await this.getMemory(key);
    this.memory.delete(key);
    return value;
  }
}

let cachedStore: VerificationBufferStore | null = null;
export const getVerificationBufferStore = (): VerificationBufferStore => {
  if (cachedStore) return cachedStore;
  cachedStore = new VerificationBufferStore();
  return cachedStore;
};
