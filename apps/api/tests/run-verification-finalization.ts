import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./.env.test', import.meta.url));
delete process.env.REDIS_URL;

const { VerificationBufferStore } =
  await import('../src/infrastructure/verification/buffer-store.js');
const { VerificationFinalizationQueue } =
  await import('../src/infrastructure/verification/finalization-queue.js');
const { VerificationWorkflowService } =
  await import('../src/domain/services/verification-workflow-service.js');

type VerificationOutcome = {
  status: 'verified' | 'flagged' | 'rejected';
  method: 'groq' | 'gemini' | 'manual';
  reason?: string;
};

type VerificationPayload = {
  userId: string;
  bufferKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type VerificationFinalizationPayload = VerificationPayload & {
  firstMethod: 'groq' | 'gemini' | 'manual';
  firstReason?: string;
};

type FakeWorkflow = {
  authRepository: {
    findById: (userId: string) => Promise<Record<string, unknown> | null>;
    updateVerificationState: (
      userId: string,
      patch: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
  };
  bufferStore: {
    delete: (key: string) => Promise<void>;
  };
  finalizationQueue: {
    enqueue: (payload: VerificationFinalizationPayload) => Promise<void>;
  };
  verifyDocument: (
    payload: VerificationPayload,
    user: Record<string, unknown>,
    options?: { finalPass?: boolean },
  ) => Promise<VerificationOutcome>;
  processJob: (payload: VerificationPayload) => Promise<void>;
  processFinalizationJob: (payload: VerificationFinalizationPayload) => Promise<void>;
};

const waitForTick = () => new Promise((resolve) => setImmediate(resolve));

const runBufferChecks = async () => {
  const store = new VerificationBufferStore();
  const key = `verification-test:${Date.now()}`;
  const value = Buffer.from('temporary verification document bytes');

  await store.set(key, value, 60);

  const firstRead = await store.get(key);
  assert.ok(firstRead);
  assert.equal(firstRead.toString('utf8'), value.toString('utf8'));

  const secondRead = await store.get(key);
  assert.ok(secondRead);
  assert.equal(secondRead.toString('utf8'), value.toString('utf8'));

  const taken = await store.take(key);
  assert.ok(taken);
  assert.equal(taken.toString('utf8'), value.toString('utf8'));

  const afterTake = await store.get(key);
  assert.equal(afterTake, null);
};

const runFinalizationQueueChecks = async () => {
  const queue = new VerificationFinalizationQueue();
  const received: unknown[] = [];

  queue.registerProcessor(async (payload) => {
    received.push(payload);
  });

  await queue.enqueue({
    userId: 'user-123',
    bufferKey: 'buffer-123',
    originalName: 'course-form.png',
    mimeType: 'image/png',
    size: 1024,
    firstMethod: 'groq',
    firstReason: 'Automated extraction produced low-confidence results; admin review required.',
  });

  await waitForTick();

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], {
    userId: 'user-123',
    bufferKey: 'buffer-123',
    originalName: 'course-form.png',
    mimeType: 'image/png',
    size: 1024,
    firstMethod: 'groq',
    firstReason: 'Automated extraction produced low-confidence results; admin review required.',
  });
};

const runWorkflowChecks = async () => {
  const service = new VerificationWorkflowService() as unknown as FakeWorkflow;
  const updates: Array<{ userId: string; patch: Record<string, unknown> }> = [];
  const deletedKeys: string[] = [];
  const queuedFinalization: VerificationFinalizationPayload[] = [];
  const user = {
    id: 'user-123',
    name: 'Ada Student',
    email: 'ada@example.com',
    matric_number: '190404001',
    verification_status: 'pending',
    verification_attempts: 1,
  };
  const payload: VerificationPayload = {
    userId: user.id,
    bufferKey: 'buffer-123',
    originalName: 'course-form.png',
    mimeType: 'image/png',
    size: 1024,
  };

  service.authRepository = {
    findById: async () => user,
    updateVerificationState: async (userId, patch) => {
      updates.push({ userId, patch });
      return { ...user, ...patch };
    },
  };
  service.bufferStore = {
    delete: async (key) => {
      deletedKeys.push(key);
    },
  };
  service.finalizationQueue = {
    enqueue: async (nextPayload) => {
      queuedFinalization.push(nextPayload);
    },
  };
  service.verifyDocument = async (_payload, _user, options) =>
    options?.finalPass
      ? { status: 'verified', method: 'gemini' }
      : {
          status: 'flagged',
          method: 'groq',
          reason: 'Automated extraction produced low-confidence results; admin review required.',
        };

  await service.processJob(payload);

  assert.equal(updates.length, 0);
  assert.equal(deletedKeys.length, 0);
  assert.deepEqual(queuedFinalization, [
    {
      ...payload,
      firstMethod: 'groq',
      firstReason: 'Automated extraction produced low-confidence results; admin review required.',
    },
  ]);

  await service.processFinalizationJob(queuedFinalization[0]);

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.userId, user.id);
  assert.equal(updates[0]?.patch.verification_status, 'verified');
  assert.equal(updates[0]?.patch.verification_method, 'gemini');
  assert.equal(typeof updates[0]?.patch.verification_timestamp, 'string');
  assert.deepEqual(deletedKeys, [payload.bufferKey]);
};

await runBufferChecks();
await runFinalizationQueueChecks();
await runWorkflowChecks();

// eslint-disable-next-line no-console
console.log('Verification finalization regression checks passed');
