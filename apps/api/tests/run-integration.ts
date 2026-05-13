import assert from 'node:assert/strict';
import http from 'node:http';

import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./.env.test', import.meta.url));
delete process.env.REDIS_URL;

const { createApp } = await import('../src/app.js');

const app = createApp();
const server = app.listen(0);
server.keepAliveTimeout = 1;

await new Promise<void>((resolve) => server.once('listening', () => resolve()));

const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Failed to bind integration test server');
}

const baseUrl = `http://127.0.0.1:${address.port}`;

const request = (
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> =>
  new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: {
          connection: 'close',
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });

const run = async () => {
  const healthResponse = await request('/api/v1/health');
  assert.equal(healthResponse.statusCode, 200);
  const healthBody = JSON.parse(healthResponse.body) as {
    success: boolean;
    data: { status: string; service: string };
  };
  assert.equal(healthBody.success, true);
  assert.equal(healthBody.data.status, 'ok');
  assert.equal(healthBody.data.service, 'pidec-api');

  const crossOriginResponse = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://evil.example.com',
    },
    body: JSON.stringify({
      email: 'not-an-email',
      password: '',
    }),
  });
  assert.equal(crossOriginResponse.statusCode, 400);
  assert.equal(crossOriginResponse.headers['access-control-allow-origin'], 'http://evil.example.com');
  assert.ok(crossOriginResponse.body.length > 0);

  const unauthenticatedResponse = await request('/api/v1/users/me');
  assert.equal(unauthenticatedResponse.statusCode, 401);

  const invalidLoginResponse = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'not-an-email',
      password: '',
    }),
  });
  assert.equal(invalidLoginResponse.statusCode, 400);
  const invalidLoginBody = JSON.parse(invalidLoginResponse.body) as {
    success: false;
    error: { code: string; details?: unknown };
  };
  assert.equal(invalidLoginBody.error.code, 'VALIDATION_ERROR');
  assert.ok(invalidLoginBody.error.details);
};

try {
  await run();
  // eslint-disable-next-line no-console
  console.log('Backend integration checks passed');
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
