import Redis from 'ioredis';
import { env } from '../../shared/config/env.js';

type MemoryEntry = {
  failures: number;
  lockedUntil: number | null;
  expiresAt: number;
};

const MAX_FAILURES = 5;

export class LoginAttemptStore {
  private readonly redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
      })
    : null;

  private readonly memory = new Map<string, MemoryEntry>();

  private getKey(email: string): string {
    return `auth:login-fail:${email.toLowerCase()}`;
  }

  private async getMemory(email: string): Promise<MemoryEntry | null> {
    const key = this.getKey(email);
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return entry;
  }

  async getStatus(email: string): Promise<{ failures: number; lockedUntil: number | null }> {
    const key = this.getKey(email);
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        const [failuresRaw, lockedUntilRaw] = await this.redis.hmget(key, 'failures', 'lockedUntil');
        return {
          failures: Number(failuresRaw ?? 0),
          lockedUntil: lockedUntilRaw ? Number(lockedUntilRaw) : null,
        };
      } catch {
        // fall back to memory
      }
    }

    const entry = await this.getMemory(email);
    return {
      failures: entry?.failures ?? 0,
      lockedUntil: entry?.lockedUntil ?? null,
    };
  }

  async clear(email: string): Promise<void> {
    const key = this.getKey(email);
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        await this.redis.del(key);
        return;
      } catch {
        // fall back to memory
      }
    }
    this.memory.delete(key);
  }

  async recordFailure(email: string): Promise<{ failures: number; lockedUntil: number | null }> {
    const key = this.getKey(email);
    const ttlSeconds = Math.ceil(env.RATE_LIMIT_LOGIN_WINDOW_MS / 1000);

    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        const failures = await this.redis.hincrby(key, 'failures', 1);
        let lockedUntil: number | null = null;
        if (failures >= MAX_FAILURES) {
          lockedUntil = Date.now() + env.RATE_LIMIT_LOGIN_WINDOW_MS;
          await this.redis.hset(key, 'lockedUntil', String(lockedUntil));
        }
        await this.redis.expire(key, ttlSeconds);
        return { failures, lockedUntil };
      } catch {
        // fall back to memory
      }
    }

    const existing = await this.getMemory(email);
    const failures = (existing?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? Date.now() + env.RATE_LIMIT_LOGIN_WINDOW_MS : null;
    this.memory.set(key, {
      failures,
      lockedUntil,
      expiresAt: Date.now() + env.RATE_LIMIT_LOGIN_WINDOW_MS,
    });
    return { failures, lockedUntil };
  }
}

let cached: LoginAttemptStore | null = null;
export const getLoginAttemptStore = (): LoginAttemptStore => {
  if (cached) return cached;
  cached = new LoginAttemptStore();
  return cached;
};
