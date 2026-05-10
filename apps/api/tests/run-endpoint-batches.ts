import assert from 'node:assert/strict';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

const loadedEnv = loadEnv({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

if (loadedEnv.error) {
  throw loadedEnv.error;
}

process.env.NEXT_PUBLIC_SUPABASE_URL = loadedEnv.parsed?.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = loadedEnv.parsed?.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = loadedEnv.parsed?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.APP_URL = 'http://localhost:3000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.COOKIE_DOMAIN = 'localhost';
process.env.LOG_LEVEL = 'warn';
process.env.AUTH_TOKEN_ISSUER = 'pidec-api';
process.env.AUTH_ACCESS_TOKEN_SECRET =
  'test-access-token-secret-should-be-long-enough-1234567890';
process.env.AUTH_REFRESH_TOKEN_SECRET =
  'test-refresh-token-secret-should-be-long-enough-0987654321';
process.env.GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./.env.test', import.meta.url));
process.env.NODE_ENV = 'development';
delete process.env.REDIS_URL;
process.env.RESEND_API_KEY = '';

const { createApp } = await import('../src/app.js');
const { getSupabaseService } = await import('../src/infrastructure/db/supabase.js');
const { hashPassword } = await import('../src/infrastructure/auth/password.js');
const { AuthRepository } = await import('../src/domain/repositories/auth-repository.js');
const { TokenRepository } = await import('../src/domain/repositories/verification-token-repository.js');
const {
  generateSecureToken,
  getTokenExpiryMinutes,
} = await import('../src/infrastructure/auth/token-utils.js');

type JsonRecord = Record<string, unknown>;
type JsonValue = JsonRecord | JsonRecord[] | string | number | boolean | null;

type HttpResult = {
  status: number;
  headers: Headers;
  text: string;
  json: JsonValue | null;
};

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  json?: JsonRecord;
  body?: BodyInit;
};

type Session = {
  label: string;
  cookies: Map<string, string>;
};

type UserSeed = {
  email: string;
  password: string;
  name: string;
  matricNumber: string;
  department: string;
  level: number;
};

const supabase = getSupabaseService();
const authRepository = new AuthRepository();
const tokenRepository = new TokenRepository();

const app = createApp();
const server = app.listen(0, '127.0.0.1');
server.keepAliveTimeout = 1;
await new Promise<void>((resolve) => server.once('listening', () => resolve()));

const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Failed to start test server');
}

const baseUrl = `http://localhost:${address.port}`;
const runId = `e2e-${Date.now()}`;
const department = 'Computer Engineering';
let adminRestoreState:
  | { id: string; email: string; passwordHash: string | null }
  | null = null;

const makeSession = (label: string): Session => ({
  label,
  cookies: new Map<string, string>(),
});

const updateCookies = (session: Session, headers: Headers) => {
  const getSetCookie = headers.getSetCookie?.bind(headers);
  const rawCookies = getSetCookie ? getSetCookie() : [];

  for (const rawCookie of rawCookies) {
    const [pair] = rawCookie.split(';');
    if (!pair) continue;
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!value) {
      session.cookies.delete(name);
      continue;
    }
    session.cookies.set(name, value);
  }
};

const cookieHeader = (session: Session): string | null => {
  if (session.cookies.size === 0) return null;
  return Array.from(session.cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

const request = async (
  session: Session | null,
  path: string,
  options: RequestOptions = {},
): Promise<HttpResult> => {
  const headers = new Headers(options.headers ?? {});
  headers.set('origin', 'http://localhost:3000');

  if (session) {
    const cookie = cookieHeader(session);
    if (cookie) headers.set('cookie', cookie);
  }

  let body = options.body;
  if (options.json) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  if (session) {
    updateCookies(session, response.headers);
  }

  const text = await response.text();
  let json: JsonValue | null = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') && text.length > 0) {
    json = JSON.parse(text) as JsonValue;
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
  };
};

const isTransientBackendFetchFailure = (result: HttpResult): boolean => {
  if (result.status !== 500) return false;
  if (!result.json || Array.isArray(result.json) || typeof result.json !== 'object') return false;
  const payload = result.json as { error?: { message?: string } };
  return payload.error?.message?.includes('TypeError: fetch failed') ?? false;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestWithTransientRetry = async (
  session: Session | null,
  path: string,
  options: RequestOptions = {},
  attempts = 3,
): Promise<HttpResult> => {
  let lastResult: HttpResult | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await request(session, path, options);
    lastResult = result;
    if (!isTransientBackendFetchFailure(result) || attempt === attempts) {
      return result;
    }
    await wait(350 * attempt);
  }
  return lastResult as HttpResult;
};

const expectStatus = (result: HttpResult, expected: number, message: string) => {
  assert.equal(
    result.status,
    expected,
    `${message}\nExpected: ${expected}\nReceived: ${result.status}\nBody: ${result.text}`,
  );
};

const expectJsonObject = <T extends JsonRecord>(result: HttpResult, message: string): T => {
  assert.ok(result.json && !Array.isArray(result.json) && typeof result.json === 'object', `${message}\nBody: ${result.text}`);
  return result.json as T;
};

const makeMatricNumber = (offset: number): string => {
  const suffix = String((Date.now() + offset) % 100000).padStart(5, '0');
  return `2504${suffix}`;
};

const ensureActiveEdition = async () => {
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('No active edition exists in the database. Create one before running endpoint batches.');
  }

  const { error: updateError } = await supabase
    .from('editions')
    .update({
      signup_open: true,
      team_management_locked: false,
      submission_window_open: true,
      active_stage: 1,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', data.id);

  if (updateError) throw updateError;

  return data.id;
};

const findUserByEmail = async (email: string) => {
  const user = await authRepository.findByEmail(email);
  if (!user) throw new Error(`User not found for email ${email}`);
  return user;
};

const prepareAdminAccount = async (email: string, password: string) => {
  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .is('deleted_at', null)
    .maybeSingle();

  if (existingAdminError) throw existingAdminError;

  if (existingAdmin) {
    adminRestoreState = {
      id: existingAdmin.id,
      email: existingAdmin.email,
      passwordHash: existingAdmin.password_hash,
    };

    const { data, error } = await supabase
      .from('users')
      .update({
        password_hash: await hashPassword(password),
        verification_status: 'verified',
        verification_method: 'manual',
        verification_timestamp: new Date().toISOString(),
        is_suspended: false,
      } as never)
      .eq('id', existingAdmin.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  return authRepository.createUser(
    email,
    await hashPassword(password),
    `Admin ${runId}`,
    'admin',
    makeMatricNumber(99),
    department,
    500,
  ).then(async (user) => {
    const { data, error } = await supabase
      .from('users')
      .update({
        verification_status: 'verified',
        verification_method: 'manual',
        verification_timestamp: new Date().toISOString(),
      } as never)
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  });
};

const createSeedVerificationToken = async (userId: string): Promise<string> => {
  const { token, hash } = generateSecureToken();
  await tokenRepository.createVerificationToken(userId, hash, getTokenExpiryMinutes(60));
  return token;
};

const createSeedPasswordResetToken = async (userId: string): Promise<string> => {
  const { token, hash } = generateSecureToken();
  await tokenRepository.createPasswordResetToken(userId, hash, getTokenExpiryMinutes(60));
  return token;
};

const login = async (session: Session, email: string, password: string) => {
  const result = await requestWithTransientRetry(session, '/api/v1/auth/login', {
    method: 'POST',
    json: { email, password },
  });
  expectStatus(result, 200, `Login failed for ${email}`);
};

const registerStudent = async (session: Session, user: UserSeed) => {
  const result = await requestWithTransientRetry(session, '/api/v1/auth/register', {
    method: 'POST',
    json: user,
  });
  if (result.status === 409) {
    await login(session, user.email, user.password);
    return;
  }
  expectStatus(result, 201, `Registration failed for ${user.email}`);
};

const markUserVerified = async (adminSession: Session, userId: string) => {
  const result = await requestWithTransientRetry(adminSession, `/api/v1/admin/verifications/${userId}`, {
    method: 'PATCH',
    json: { decision: 'approve' },
  });
  expectStatus(result, 200, `Admin verification failed for user ${userId}`);
};

const setUserPasswordDirectly = async (email: string, password: string) => {
  const passwordHash = await hashPassword(password);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash } as never)
    .eq('email', email)
    .is('deleted_at', null);

  if (error) throw error;
};

const getLatestInviteId = async (session: Session): Promise<string> => {
  const result = await request(session, '/api/v1/teams/invites');
  expectStatus(result, 200, 'Fetching invites failed');
  const body = expectJsonObject<{ success: true; data: { invites: Array<{ id: string }> } }>(
    result,
    'Invite list response was not JSON',
  );
  const inviteId = body.data.invites[0]?.id;
  assert.ok(inviteId, 'Expected at least one invite');
  return inviteId;
};

const createPdfUpload = (): FormData => {
  const form = new FormData();
  const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const blob = new Blob([buffer], { type: 'application/pdf' });
  form.append('document', blob, 'verification.pdf');
  return form;
};

const createPublicVerificationUpload = (user: UserSeed): FormData => {
  const form = createPdfUpload();
  form.append('email', user.email);
  form.append('matricNumber', user.matricNumber);
  return form;
};

const createSubmissionPdfUpload = (stage: 1 | 2 | 3): FormData => {
  const form = new FormData();
  const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const blob = new Blob([buffer], { type: 'application/pdf' });
  form.append('stage', String(stage));
  form.append('file', blob, `stage-${stage}-proposal.pdf`);
  return form;
};

const run = async () => {
  const editionId = await ensureActiveEdition();
  void editionId;

  const adminCredentials = {
    email: `${runId}-admin@example.com`,
    password: 'Adminpass123',
  };

  const leader: UserSeed = {
    email: `${runId}-leader@example.com`,
    password: 'Studentpass123',
    name: 'Leader Student',
    matricNumber: makeMatricNumber(1),
    department,
    level: 400,
  };

  const memberA: UserSeed = {
    email: `${runId}-member-a@example.com`,
    password: 'Studentpass123',
    name: 'Member Alpha',
    matricNumber: makeMatricNumber(2),
    department,
    level: 300,
  };

  const memberB: UserSeed = {
    email: `${runId}-member-b@example.com`,
    password: 'Studentpass123',
    name: 'Member Bravo',
    matricNumber: makeMatricNumber(3),
    department,
    level: 200,
  };

  const authOnly: UserSeed = {
    email: `${runId}-auth-only@example.com`,
    password: 'Studentpass123',
    name: 'Auth Only',
    matricNumber: makeMatricNumber(4),
    department,
    level: 100,
  };

  const leaderSession = makeSession('leader');
  const memberASession = makeSession('member-a');
  const memberBSession = makeSession('member-b');
  const authOnlySession = makeSession('auth-only');
  const adminSession = makeSession('admin');
  const judge1Session = makeSession('judge-stage-1');
  const judge2Session = makeSession('judge-stage-2');

  console.log('\nBatch 1: Public, auth, and profile flow');

  expectStatus(await request(null, '/api/v1/health'), 200, 'Health endpoint failed');
  expectStatus(await request(null, '/api/v1/public/landing-data'), 200, 'Landing data failed');
  expectStatus(await request(null, '/api/v1/auth/me'), 401, 'Unauthenticated /auth/me should be 401');

  await registerStudent(leaderSession, leader);
  await registerStudent(memberASession, memberA);
  await registerStudent(memberBSession, memberB);
  await registerStudent(authOnlySession, authOnly);

  expectStatus(await request(leaderSession, '/api/v1/auth/me'), 200, 'Leader session /auth/me failed');
  expectStatus(await request(leaderSession, '/api/v1/users/me'), 200, 'Leader profile fetch failed');

  const profileUpdateResult = await request(leaderSession, '/api/v1/users/me', {
    method: 'PATCH',
    json: { name: 'Leader Student Updated', level: 500 },
  });
  expectStatus(profileUpdateResult, 200, 'Leader profile update failed');

  const authOnlyUser = await findUserByEmail(authOnly.email);
  const verificationToken = await createSeedVerificationToken(authOnlyUser.id);
  const verifyResult = await requestWithTransientRetry(null, '/api/v1/auth/verify-email', {
    method: 'POST',
    json: { token: verificationToken },
  });
  expectStatus(verifyResult, 200, 'Email verification endpoint failed');

  const forgotPasswordResult = await requestWithTransientRetry(null, '/api/v1/auth/forgot-password', {
    method: 'POST',
    json: { email: authOnly.email },
  });
  expectStatus(forgotPasswordResult, 200, 'Forgot-password endpoint failed');

  const resetToken = await createSeedPasswordResetToken(authOnlyUser.id);
  const resetResult = await requestWithTransientRetry(null, '/api/v1/auth/reset-password', {
    method: 'POST',
    json: {
      token: resetToken,
      password: 'Studentpass456',
    },
  });
  expectStatus(resetResult, 200, 'Password reset endpoint failed');

  await login(authOnlySession, authOnly.email, 'Studentpass456');
  expectStatus(await requestWithTransientRetry(authOnlySession, '/api/v1/auth/refresh', { method: 'POST' }), 200, 'Refresh endpoint failed');
  expectStatus(await requestWithTransientRetry(authOnlySession, '/api/v1/auth/logout', { method: 'POST' }), 200, 'Logout failed');
  expectStatus(await request(authOnlySession, '/api/v1/auth/me'), 401, 'Logged-out session should not resolve /auth/me');

  const verificationUploadResult = await request(null, '/api/v1/auth/verification-document', {
    method: 'POST',
    body: createPublicVerificationUpload(leader),
  });
  expectStatus(verificationUploadResult, 202, 'Verification document upload failed');
  expectStatus(await request(leaderSession, '/api/v1/auth/verification-status'), 200, 'Verification status failed');

  console.log('Batch 1 passed');

  console.log('\nBatch 2: Team and notification flow');

  const adminUser = await prepareAdminAccount(adminCredentials.email, adminCredentials.password);
  await login(adminSession, adminUser.email, adminCredentials.password);

  const leaderUser = await findUserByEmail(leader.email);
  const memberAUser = await findUserByEmail(memberA.email);
  const memberBUser = await findUserByEmail(memberB.email);

  await markUserVerified(adminSession, leaderUser.id);
  await markUserVerified(adminSession, memberAUser.id);
  await markUserVerified(adminSession, memberBUser.id);

  const teamCreateResult = await request(leaderSession, '/api/v1/teams', {
    method: 'POST',
    json: { name: `Team ${runId}` },
  });
  expectStatus(teamCreateResult, 201, 'Team creation failed');
  const teamId = expectJsonObject<{ success: true; data: { team: { id: string } } }>(
    teamCreateResult,
    'Team create response missing JSON',
  ).data.team.id;

  expectStatus(
    await request(leaderSession, `/api/v1/teams/search?query=Member`),
    200,
    'Teammate search failed',
  );

  expectStatus(
    await request(leaderSession, '/api/v1/teams/invites', {
      method: 'POST',
      json: { inviteeId: memberAUser.id },
    }),
    201,
    'Sending invite to member A failed',
  );

  expectStatus(
    await request(leaderSession, '/api/v1/teams/invites', {
      method: 'POST',
      json: { inviteeId: memberBUser.id },
    }),
    201,
    'Sending invite to member B failed',
  );

  const inviteAId = await getLatestInviteId(memberASession);
  const inviteBId = await getLatestInviteId(memberBSession);

  const memberANotifications = await request(memberASession, '/api/v1/notifications');
  expectStatus(memberANotifications, 200, 'Member A notifications failed');
  const notificationBody = expectJsonObject<{
    success: true;
    data: { items: Array<{ id: string }> };
  }>(memberANotifications, 'Notification response was not JSON');
  const notificationId = notificationBody.data.items[0]?.id;
  assert.ok(notificationId, 'Expected an invite notification for member A');

  expectStatus(
    await request(memberASession, `/api/v1/notifications/${notificationId}/read`, { method: 'PATCH' }),
    200,
    'Marking notification as read failed',
  );
  expectStatus(
    await request(memberASession, '/api/v1/notifications/read-all', { method: 'POST' }),
    200,
    'Mark-all notifications failed',
  );

  expectStatus(
    await request(memberASession, '/api/v1/teams/invites/respond', {
      method: 'POST',
      json: { inviteId: inviteAId, status: 'accepted' },
    }),
    200,
    'Member A invite acceptance failed',
  );

  expectStatus(
    await request(memberBSession, `/api/v1/teams/invites/${inviteBId}/accept`, {
      method: 'POST',
    }),
    200,
    'Member B invite acceptance failed',
  );

  expectStatus(await request(leaderSession, '/api/v1/teams/my'), 200, 'Leader team fetch failed');
  expectStatus(await request(memberASession, '/api/v1/teams/me'), 200, 'Member A team fetch failed');

  console.log('Batch 2 passed');

  console.log('\nBatch 3: Submission and feedback flow');

  const tokenResult = await request(adminSession, '/api/v1/admin/tokens', {
    method: 'POST',
    json: { department },
  });
  expectStatus(tokenResult, 201, 'Department token generation failed');
  const tokenBody = expectJsonObject<{ success: true; data: { token: { token_string: string } } }>(
    tokenResult,
    'Token response was not JSON',
  );
  const submissionToken = tokenBody.data.token.token_string;
  const stage1UploadResult = await request(leaderSession, '/api/v1/submissions/files', {
    method: 'POST',
    body: createSubmissionPdfUpload(1),
  });
  expectStatus(stage1UploadResult, 201, 'Stage 1 proposal upload failed');
  const stage1UploadBody = expectJsonObject<{ success: true; data: { file: { id: string } } }>(
    stage1UploadResult,
    'Stage 1 upload response was not JSON',
  );

  const stage1Result = await request(leaderSession, '/api/v1/submissions', {
    method: 'POST',
    json: {
      token: submissionToken,
      formData: { submission_type: 'document_upload' },
      fileIds: [stage1UploadBody.data.file.id],
    },
  });
  expectStatus(stage1Result, 201, 'Stage 1 submission failed');
  const stage1Body = expectJsonObject<{ success: true; data: { submission: { id: string } } }>(
    stage1Result,
    'Stage 1 response was not JSON',
  );
  const stage1SubmissionId = stage1Body.data.submission.id;

  expectStatus(await request(leaderSession, '/api/v1/submissions/me'), 200, 'Listing submissions failed');
  expectStatus(await request(leaderSession, '/api/v1/feedback/me'), 200, 'Listing feedback before publish failed');

  const enterFeedbackResult = await request(adminSession, `/api/v1/admin/feedback/${stage1SubmissionId}`, {
    method: 'POST',
    json: {
      scores: { originality: 88, feasibility: 92 },
      comments: { summary: 'Strong concept and clear justification.' },
      totalScore: 90,
      outcome: 'advanced',
      evaluatorName: 'Admin Evaluator',
      evaluationDate: '2026-05-05',
    },
  });
  expectStatus(enterFeedbackResult, 200, 'Admin feedback entry failed');

  expectStatus(
    await request(adminSession, `/api/v1/admin/feedback/${stage1SubmissionId}/publish`, {
      method: 'PATCH',
    }),
    200,
    'Publishing stage 1 feedback failed',
  );

  expectStatus(
    await request(leaderSession, `/api/v1/submissions/${stage1SubmissionId}/feedback`),
    200,
    'Submission feedback lookup failed',
  );
  expectStatus(
    await request(leaderSession, `/api/v1/feedback/${stage1SubmissionId}`),
    200,
    'Feedback alias endpoint failed',
  );

  expectStatus(
    await request(adminSession, `/api/v1/admin/teams/${teamId}/stage`, {
      method: 'PATCH',
      json: { action: 'advance' },
    }),
    200,
    'Advancing team to stage 2 failed',
  );

  expectStatus(
    await request(adminSession, '/api/v1/admin/stage', {
      method: 'POST',
      json: { stage: 2 },
    }),
    200,
    'Setting active stage 2 failed',
  );

  const stage2Result = await request(leaderSession, '/api/v1/submissions', {
    method: 'POST',
    json: {
      videoLink: 'https://youtu.be/pidec-stage-two-demo',
      formData: {
        design_summary: 'The prototype architecture and mechanical layout are documented clearly.',
        engineering_decisions: 'We selected components based on reliability, cost, and campus deployment conditions.',
        constraints_addressed: 'Power, durability, maintenance, and operator ease-of-use were addressed.',
        testing_results: 'Bench testing and controlled scenario testing showed stable operation.',
      },
      fileIds: ['stage2-doc-1'],
    },
  });
  expectStatus(stage2Result, 201, 'Stage 2 submission failed');
  const stage2Body = expectJsonObject<{ success: true; data: { submission: { id: string } } }>(
    stage2Result,
    'Stage 2 response was not JSON',
  );
  const stage2SubmissionId = stage2Body.data.submission.id;

  expectStatus(
    await request(adminSession, `/api/v1/admin/teams/${teamId}/stage`, {
      method: 'PATCH',
      json: { action: 'advance' },
    }),
    200,
    'Advancing team to stage 3 failed',
  );

  expectStatus(
    await request(adminSession, '/api/v1/admin/stage', {
      method: 'POST',
      json: { stage: 3 },
    }),
    200,
    'Setting active stage 3 failed',
  );

  expectStatus(
    await request(leaderSession, '/api/v1/submissions', {
      method: 'POST',
      json: {
        formData: {
          final_documentation_summary: 'The final package includes the refined build, operation notes, and deployment summary.',
          team_ready: true,
        },
        fileIds: ['stage3-doc-1'],
      },
    }),
    201,
    'Stage 3 submission failed',
  );

  console.log('Batch 3 passed');

  console.log('\nBatch 4: Admin, content, export, and settings flow');

  expectStatus(await request(adminSession, '/api/v1/admin/overview'), 200, 'Admin overview failed');
  expectStatus(await request(adminSession, '/api/v1/admin/students'), 200, 'Admin students failed');
  expectStatus(await request(adminSession, '/api/v1/admin/teams'), 200, 'Admin teams failed');
  expectStatus(await request(adminSession, '/api/v1/admin/submissions'), 200, 'Admin submissions failed');
  expectStatus(await request(adminSession, '/api/v1/admin/verifications/flagged'), 200, 'Admin flagged verification queue failed');
  expectStatus(await request(adminSession, '/api/v1/admin/tokens'), 200, 'Admin token list failed');
  expectStatus(await request(adminSession, '/api/v1/admin/export/students'), 200, 'Student export failed');
  expectStatus(await request(adminSession, '/api/v1/admin/export/teams'), 200, 'Team export failed');
  expectStatus(await request(adminSession, '/api/v1/admin/export/submissions'), 200, 'Submission export failed');

  const checkpointCreate = await request(adminSession, '/api/v1/admin/checkpoints', {
    method: 'POST',
    json: {
      title: `Checkpoint ${runId}`,
      description: 'Stage 2 manufacturing readiness check.',
      dueAt: '2026-06-01T12:00:00.000Z',
      sortOrder: 0,
      isActive: true,
    },
  });
  if (checkpointCreate.status === 201) {
    const checkpointBody = expectJsonObject<{ success: true; data: { checkpoint: { id: string } } }>(
      checkpointCreate,
      'Checkpoint response was not JSON',
    );
    const checkpointId = checkpointBody.data.checkpoint.id;

    expectStatus(await request(adminSession, '/api/v1/admin/checkpoints'), 200, 'Checkpoint list failed');
    expectStatus(
      await request(adminSession, `/api/v1/admin/checkpoints/${checkpointId}`, {
        method: 'PATCH',
        json: { title: `Checkpoint ${runId} Updated` },
      }),
      200,
      'Checkpoint update failed',
    );
    expectStatus(
      await request(adminSession, `/api/v1/admin/checkpoints/${checkpointId}`, {
        method: 'DELETE',
      }),
      200,
      'Checkpoint delete failed',
    );
  } else {
    expectStatus(
      checkpointCreate,
      404,
      'Checkpoint create should fail clearly when the table is unavailable',
    );
    expectStatus(await request(adminSession, '/api/v1/admin/checkpoints'), 200, 'Checkpoint list failed');
  }

  const sponsorCreate = await request(adminSession, '/api/v1/admin/content/sponsors', {
    method: 'POST',
    json: {
      name: `Sponsor ${runId}`,
      logoUrl: 'https://example.com/sponsor.png',
      websiteUrl: 'https://example.com',
      sortOrder: 0,
      isActive: true,
    },
  });
  expectStatus(await request(adminSession, '/api/v1/admin/content/sponsors'), 200, 'Sponsor list failed');
  if (sponsorCreate.status === 201) {
    const sponsorId = expectJsonObject<{ success: true; data: { sponsor: { id: string } } }>(
      sponsorCreate,
      'Sponsor response was not JSON',
    ).data.sponsor.id;
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/sponsors/${sponsorId}`, {
        method: 'PATCH',
        json: { name: `Sponsor ${runId} Updated` },
      }),
      200,
      'Sponsor update failed',
    );
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/sponsors/${sponsorId}`, {
        method: 'DELETE',
      }),
      200,
      'Sponsor delete failed',
    );
  } else {
    expectStatus(
      sponsorCreate,
      404,
      'Sponsor create should fail clearly when landing content tables are unavailable',
    );
  }

  const partnerCreate = await request(adminSession, '/api/v1/admin/content/partners', {
    method: 'POST',
    json: {
      name: `Partner ${runId}`,
      logoUrl: 'https://example.com/partner.png',
      websiteUrl: 'https://example.com',
      sortOrder: 0,
      isActive: true,
    },
  });
  expectStatus(await request(adminSession, '/api/v1/admin/content/partners'), 200, 'Partner list failed');
  if (partnerCreate.status === 201) {
    const partnerId = expectJsonObject<{ success: true; data: { partner: { id: string } } }>(
      partnerCreate,
      'Partner response was not JSON',
    ).data.partner.id;
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/partners/${partnerId}`, {
        method: 'PATCH',
        json: { name: `Partner ${runId} Updated` },
      }),
      200,
      'Partner update failed',
    );
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/partners/${partnerId}`, {
        method: 'DELETE',
      }),
      200,
      'Partner delete failed',
    );
  } else {
    expectStatus(
      partnerCreate,
      404,
      'Partner create should fail clearly when landing content tables are unavailable',
    );
  }

  const faqCreate = await request(adminSession, '/api/v1/admin/content/faqs', {
    method: 'POST',
    json: {
      question: `How does ${runId} work?`,
      answer: 'This is a temporary automated test FAQ.',
      sortOrder: 0,
      isActive: true,
    },
  });
  expectStatus(await request(adminSession, '/api/v1/admin/content/faqs'), 200, 'FAQ list failed');
  if (faqCreate.status === 201) {
    const faqId = expectJsonObject<{ success: true; data: { faq: { id: string } } }>(
      faqCreate,
      'FAQ response was not JSON',
    ).data.faq.id;
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/faqs/${faqId}`, {
        method: 'PATCH',
        json: { answer: 'Updated automated test FAQ answer.' },
      }),
      200,
      'FAQ update failed',
    );
    expectStatus(
      await request(adminSession, `/api/v1/admin/content/faqs/${faqId}`, {
        method: 'DELETE',
      }),
      200,
      'FAQ delete failed',
    );
  } else {
    expectStatus(
      faqCreate,
      404,
      'FAQ create should fail clearly when landing content tables are unavailable',
    );
  }

  expectStatus(
    await request(adminSession, `/api/v1/admin/students/${authOnlyUser.id}/suspend`, {
      method: 'PATCH',
      json: { reason: 'Endpoint test suspension' },
    }),
    200,
    'Suspending test user failed',
  );
  expectStatus(
    await request(adminSession, `/api/v1/admin/users/${authOnlyUser.id}/unsuspend`, {
      method: 'POST',
    }),
    200,
    'Unsuspending test user failed',
  );

  console.log('Batch 4 passed');

  console.log('\nBatch 5: Judge flow');

  const judge1Email = `${runId}-judge-stage1@example.com`;
  const judge2Email = `${runId}-judge-stage2@example.com`;
  const judgePassword = 'Judgepass123';

  const judge1Create = await request(adminSession, '/api/v1/admin/judges', {
    method: 'POST',
    json: {
      name: `Judge One ${runId}`,
      email: judge1Email,
      stageScope: 'stage_1',
      assignedDepartments: [department],
    },
  });
  expectStatus(judge1Create, 201, 'Stage 1 judge creation failed');

  const judge2Create = await request(adminSession, '/api/v1/admin/judges', {
    method: 'POST',
    json: {
      name: `Judge Two ${runId}`,
      email: judge2Email,
      stageScope: 'stage_2',
      assignedDepartments: [department],
    },
  });
  expectStatus(judge2Create, 201, 'Stage 2 judge creation failed');

  const judge1Id = expectJsonObject<{ success: true; data: { judge: { id: string } } }>(
    judge1Create,
    'Judge 1 response was not JSON',
  ).data.judge.id;
  void expectJsonObject<{ success: true; data: { judge: { id: string } } }>(
    judge2Create,
    'Judge 2 response was not JSON',
  ).data.judge.id;

  await setUserPasswordDirectly(judge1Email, judgePassword);
  await setUserPasswordDirectly(judge2Email, judgePassword);

  await login(judge1Session, judge1Email, judgePassword);
  await login(judge2Session, judge2Email, judgePassword);

  expectStatus(await request(judge1Session, '/api/v1/judge/me'), 200, 'Judge 1 profile failed');
  expectStatus(await request(judge2Session, '/api/v1/judge/me'), 200, 'Judge 2 profile failed');

  const judge1OutOfScope = await request(judge1Session, '/api/v1/judge/submissions?stage=2');
  expectStatus(judge1OutOfScope, 403, 'Judge 1 should be blocked from stage 2 submissions');

  const judge1Submissions = await request(judge1Session, '/api/v1/judge/submissions?stage=1');
  expectStatus(judge1Submissions, 200, 'Judge 1 submission list failed');
  expectStatus(
    await request(judge1Session, `/api/v1/judge/selections/${encodeURIComponent(department)}`, {
      method: 'POST',
      json: {
        submissionId: stage1SubmissionId,
        comments: 'Selected as departmental representative for stage 1.',
      },
    }),
    200,
    'Judge 1 representative selection failed',
  );

  const judge2Submissions = await request(judge2Session, '/api/v1/judge/submissions?stage=2');
  expectStatus(judge2Submissions, 200, 'Judge 2 submission list failed');
  expectStatus(
    await request(judge2Session, `/api/v1/judge/scores/${stage2SubmissionId}`, {
      method: 'POST',
      json: {
        scores: { innovation: 84, technical_execution: 91 },
        comments: { summary: 'Strong execution with a clear prototype story.' },
      },
    }),
    200,
    'Judge 2 score submission failed',
  );

  expectStatus(await request(adminSession, '/api/v1/admin/judges'), 200, 'Admin judge list failed');
  expectStatus(
    await request(adminSession, `/api/v1/admin/judges/${judge1Id}/deactivate`, {
      method: 'POST',
    }),
    200,
    'Judge deactivation failed',
  );

  console.log('Batch 5 passed');
  console.log('\nAll endpoint batches passed');
};

try {
  await run();
} finally {
  if (adminRestoreState) {
    await supabase
      .from('users')
      .update({ password_hash: adminRestoreState.passwordHash } as never)
      .eq('id', adminRestoreState.id);
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
