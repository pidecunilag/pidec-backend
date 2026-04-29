-- =============================================================================
-- PIDEC 1.0 — 0002: Enum types
-- =============================================================================
-- All enum types used across the schema. Enums are defined first so tables
-- can reference them without forward declarations. To add a new value later,
-- use: alter type <enum> add value 'new_value';
-- =============================================================================

do $$ begin
  create type verification_status as enum (
    'pending',
    'verified',
    'rejected',
    'flagged',
    'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_method as enum (
    'groq',
    'gemini',
    'manual'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type team_status as enum (
    'active',
    'disqualified',
    'under_review'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type invite_status as enum (
    'pending',
    'accepted',
    'declined',
    'expired',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum (
    'submitted',
    'under_review',
    'feedback_published'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type judge_stage_scope as enum (
    'stage_1',
    'stage_2'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'verification_approved',
    'verification_rejected',
    'verification_flagged',
    'invite_received',
    'invite_accepted',
    'invite_declined',
    'invite_expired',
    'team_locked',
    'team_dissolved',
    'member_removed',
    'submission_confirmed',
    'stage_advanced',
    'feedback_published',
    'team_disqualified',
    'leader_promoted',
    'announcement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_log_action as enum (
    'verification_approve',
    'verification_reject',
    'verification_request_resubmission',
    'user_suspend',
    'user_unsuspend',
    'team_advance',
    'team_disqualify',
    'team_unlock_submission',
    'team_dissolve',
    'token_generate',
    'token_regenerate',
    'feedback_enter',
    'feedback_publish',
    'edition_update',
    'stage_set',
    'submission_window_open',
    'submission_window_close',
    'signup_toggle',
    'team_lock',
    'judge_create',
    'judge_deactivate'
  );
exception when duplicate_object then null; end $$;