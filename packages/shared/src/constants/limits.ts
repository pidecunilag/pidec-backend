export const TEAM_LIMITS = {
  MIN_MEMBERS: 3,
  MAX_MEMBERS: 6,
  TEAM_NAME_MIN: 3,
  TEAM_NAME_MAX: 50,
} as const;

export const INVITE_LIMITS = {
  EXPIRY_MS: 48 * 60 * 60 * 1000, // 48 hours
  POLL_INTERVAL_MS: 60 * 1000,    // 60 seconds (frontend dashboard polling)
} as const;

export const VERIFICATION_LIMITS = {
  MAX_ATTEMPTS: 3,
  COOLDOWN_MS: 30 * 1000,        // 30 seconds between re-uploads
  REDIS_BUFFER_TTL_S: 60,        // 60 seconds — file buffer expiry in Redis
  MAX_CONCURRENT_AI_JOBS: 10,
  ADMIN_REVIEW_SLA_HOURS: 24,
} as const;

export const FILE_LIMITS = {
  VERIFICATION_DOC_MAX_BYTES: 5 * 1024 * 1024,   // 5 MB
  SUBMISSION_FILE_MAX_BYTES: 50 * 1024 * 1024,   // 50 MB
  PUBLIC_ASSET_MAX_BYTES: 5 * 1024 * 1024,       // 5 MB
} as const;

export const VERIFICATION_DOC_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const SUBMISSION_FILE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const STAGE_1_PROPOSAL_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const SESSION = {
  ACCESS_TOKEN_TTL_MS: 15 * 60 * 1000,           // 15 minutes
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  IDLE_WARNING_MS: 30 * 60 * 1000,               // 30 minutes
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
