/**
 * Hand-written Supabase Database type that mirrors the schema in
 * /supabase/migrations.
 *
 * This shape is what `@supabase/supabase-js` consumes via:
 *   createClient<Database>(...)
 *
 * If you ever decide to use the Supabase CLI in the future:
 *   npx supabase gen types typescript --project-id YOUR_REF > src/index.ts
 *
 * Until then, keep this file in sync with the migrations BY HAND. Anything
 * out of sync = type errors at compile time → caught early.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Enums ──────────────────────────────────────────────────────────────────
export type DbVerificationStatus = 'pending' | 'verified' | 'rejected' | 'flagged' | 'suspended';
export type DbVerificationMethod = 'groq' | 'gemini' | 'manual';
export type DbTeamStatus = 'active' | 'disqualified' | 'under_review';
export type DbInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type DbSubmissionStatus = 'submitted' | 'under_review' | 'feedback_published';
export type DbJudgeStageScope = 'stage_1' | 'stage_2';
export type DbNotificationType =
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_flagged'
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'invite_expired'
  | 'team_locked'
  | 'team_dissolved'
  | 'member_removed'
  | 'submission_confirmed'
  | 'stage_advanced'
  | 'feedback_published'
  | 'team_disqualified'
  | 'leader_promoted'
  | 'announcement';
export type DbAdminLogAction =
  | 'verification_approve'
  | 'verification_reject'
  | 'verification_request_resubmission'
  | 'user_suspend'
  | 'user_unsuspend'
  | 'team_advance'
  | 'team_disqualify'
  | 'team_unlock_submission'
  | 'team_dissolve'
  | 'token_generate'
  | 'token_regenerate'
  | 'feedback_enter'
  | 'feedback_publish'
  | 'edition_update'
  | 'stage_set'
  | 'submission_window_open'
  | 'submission_window_close'
  | 'signup_toggle'
  | 'team_lock'
  | 'judge_create'
  | 'judge_deactivate';

// ── Row types ──────────────────────────────────────────────────────────────
export interface DbEdition {
  id: string;
  name: string;
  theme: string | null;
  active_stage: number;
  signup_open: boolean;
  team_management_locked: boolean;
  submission_window_open: boolean;
  is_active: boolean;
  announcement_banner: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbUser {
  id: string;
  name: string;
  email: string;
  matric_number: string;
  department: string;
  level: number;
  verification_status: DbVerificationStatus;
  verification_method: DbVerificationMethod | null;
  verification_timestamp: string | null;
  verification_attempts: number;
  last_verification_attempt_at: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  password_hash: string | null;
  team_id: string | null;
  role: 'student' | 'admin' | 'judge';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbTeam {
  id: string;
  edition_id: string;
  name: string;
  department: string;
  leader_id: string;
  current_stage: number;
  status: DbTeamStatus;
  disqualified_at_stage: number | null;
  disqualified_at: string | null;
  disqualified_reason: string | null;
  is_stage_2_representative: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbTeamInvite {
  id: string;
  team_id: string;
  invitee_id: string;
  invited_by: string;
  status: DbInviteStatus;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbSubmission {
  id: string;
  team_id: string;
  edition_id: string;
  submitted_by: string;
  stage: number;
  form_data: Json;
  files: Json;
  video_link: string | null;
  status: DbSubmissionStatus;
  is_locked: boolean;
  token_id: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbJudge {
  id: string;
  edition_id: string;
  name: string;
  email: string;
  stage_scope: DbJudgeStageScope;
  assigned_departments: string[];
  is_active: boolean;
  created_by: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbJudgeScore {
  id: string;
  submission_id: string;
  judge_id: string;
  scores: Json;
  comments: Json;
  total_score: number | null;
  is_representative_pick: boolean;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbFeedback {
  id: string;
  submission_id: string;
  scores: Json;
  comments: Json;
  total_score: number | null;
  outcome: 'advanced' | 'not_advanced' | 'pending' | null;
  published: boolean;
  published_at: string | null;
  published_by: string | null;
  entered_by_admin: string;
  evaluator_name: string | null;
  evaluation_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbToken {
  id: string;
  edition_id: string;
  department: string;
  token_string: string;
  expires_at: string | null;
  use_count: number;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbStage2Checkpoint {
  id: string;
  edition_id: string;
  stage: 2;
  title: string;
  description: string | null;
  due_at: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbLandingAsset {
  id: string;
  edition_id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbLandingFaq {
  id: string;
  edition_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: DbNotificationType;
  title: string;
  message: string;
  action_url: string | null;
  metadata: Json;
  read: boolean;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface DbRefreshSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAdminLog {
  id: string;
  admin_id: string;
  action: DbAdminLogAction;
  target_type: string;
  target_id: string | null;
  before_value: Json | null;
  after_value: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ── Insert / Update helpers ────────────────────────────────────────────────
type WithDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type EditionDefaults =
  | 'id'
  | 'active_stage'
  | 'signup_open'
  | 'team_management_locked'
  | 'submission_window_open'
  | 'is_active'
  | 'announcement_banner'
  | 'theme'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at';

type UserDefaults =
  | 'verification_status'
  | 'verification_method'
  | 'verification_timestamp'
  | 'verification_attempts'
  | 'last_verification_attempt_at'
  | 'is_suspended'
  | 'suspended_at'
  | 'suspension_reason'
  | 'password_hash'
  | 'team_id'
  | 'role'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at';

// ── Database type (consumed by createClient<Database>) ─────────────────────
export interface Database {
  public: {
    Tables: {
      editions: {
        Row: DbEdition;
        Insert: WithDefaults<DbEdition, EditionDefaults>;
        Update: Partial<DbEdition>;
      };
      users: {
        Row: DbUser;
        Insert: WithDefaults<DbUser, UserDefaults>;
        Update: Partial<DbUser>;
      };
      teams: {
        Row: DbTeam;
        Insert: Partial<DbTeam> & {
          edition_id: string;
          name: string;
          department: string;
          leader_id: string;
        };
        Update: Partial<DbTeam>;
      };
      team_invites: {
        Row: DbTeamInvite;
        Insert: Partial<DbTeamInvite> & {
          team_id: string;
          invitee_id: string;
          invited_by: string;
          expires_at: string;
        };
        Update: Partial<DbTeamInvite>;
      };
      submissions: {
        Row: DbSubmission;
        Insert: Partial<DbSubmission> & {
          team_id: string;
          edition_id: string;
          submitted_by: string;
          stage: number;
        };
        Update: Partial<DbSubmission>;
      };
      judges: {
        Row: DbJudge;
        Insert: Partial<DbJudge> & {
          id: string;
          edition_id: string;
          name: string;
          email: string;
          stage_scope: DbJudgeStageScope;
          created_by: string;
        };
        Update: Partial<DbJudge>;
      };
      judge_scores: {
        Row: DbJudgeScore;
        Insert: Partial<DbJudgeScore> & {
          submission_id: string;
          judge_id: string;
        };
        Update: Partial<DbJudgeScore>;
      };
      feedback: {
        Row: DbFeedback;
        Insert: Partial<DbFeedback> & {
          submission_id: string;
          entered_by_admin: string;
        };
        Update: Partial<DbFeedback>;
      };
      tokens: {
        Row: DbToken;
        Insert: Partial<DbToken> & {
          edition_id: string;
          department: string;
          token_string: string;
          created_by: string;
        };
        Update: Partial<DbToken>;
      };
      stage_2_checkpoints: {
        Row: DbStage2Checkpoint;
        Insert: Partial<DbStage2Checkpoint> & {
          edition_id: string;
          title: string;
        };
        Update: Partial<DbStage2Checkpoint>;
      };
      landing_sponsors: {
        Row: DbLandingAsset;
        Insert: Partial<DbLandingAsset> & { edition_id: string; name: string; logo_url: string };
        Update: Partial<DbLandingAsset>;
      };
      landing_partners: {
        Row: DbLandingAsset;
        Insert: Partial<DbLandingAsset> & { edition_id: string; name: string; logo_url: string };
        Update: Partial<DbLandingAsset>;
      };
      landing_faqs: {
        Row: DbLandingFaq;
        Insert: Partial<DbLandingFaq> & { edition_id: string; question: string; answer: string };
        Update: Partial<DbLandingFaq>;
      };
      notifications: {
        Row: DbNotification;
        Insert: Partial<DbNotification> & {
          user_id: string;
          type: DbNotificationType;
          title: string;
          message: string;
        };
        Update: Partial<DbNotification>;
      };
      refresh_sessions: {
        Row: DbRefreshSession;
        Insert: Partial<DbRefreshSession> & {
          user_id: string;
          token_hash: string;
          expires_at: string;
        };
        Update: Partial<DbRefreshSession>;
      };
      admin_logs: {
        Row: DbAdminLog;
        Insert: Partial<DbAdminLog> & {
          admin_id: string;
          action: DbAdminLogAction;
          target_type: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      verification_status: DbVerificationStatus;
      verification_method: DbVerificationMethod;
      team_status: DbTeamStatus;
      invite_status: DbInviteStatus;
      submission_status: DbSubmissionStatus;
      judge_stage_scope: DbJudgeStageScope;
      notification_type: DbNotificationType;
      admin_log_action: DbAdminLogAction;
    };
  };
}
