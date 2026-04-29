-- =============================================================================
-- PIDEC 1.0 — 0014: Performance indexes
-- =============================================================================
-- All hot-path indexes called out in the master spec. Partial indexes filter
-- on `deleted_at IS NULL` so the soft-delete pattern doesn't degrade lookups.
-- =============================================================================

-- ── users ────────────────────────────────────────────────────────────────────
create index if not exists idx_users_team
  on public.users (team_id)
  where deleted_at is null and team_id is not null;

create index if not exists idx_users_department
  on public.users (department)
  where deleted_at is null;

create index if not exists idx_users_verification_status
  on public.users (verification_status)
  where deleted_at is null;

create index if not exists idx_users_role
  on public.users (role)
  where deleted_at is null;

-- ── teams ────────────────────────────────────────────────────────────────────
create index if not exists idx_teams_edition
  on public.teams (edition_id)
  where deleted_at is null;

create index if not exists idx_teams_department
  on public.teams (edition_id, department)
  where deleted_at is null;

create index if not exists idx_teams_leader
  on public.teams (leader_id)
  where deleted_at is null;

-- ── team_invites ─────────────────────────────────────────────────────────────
create index if not exists idx_invites_invitee_status
  on public.team_invites (invitee_id, status)
  where deleted_at is null;

create index if not exists idx_invites_team
  on public.team_invites (team_id)
  where deleted_at is null;

create index if not exists idx_invites_pending_expiry
  on public.team_invites (expires_at)
  where status = 'pending' and deleted_at is null;

-- ── submissions ──────────────────────────────────────────────────────────────
create index if not exists idx_submissions_team_stage
  on public.submissions (team_id, stage)
  where deleted_at is null;

create index if not exists idx_submissions_edition_stage
  on public.submissions (edition_id, stage)
  where deleted_at is null;

create index if not exists idx_submissions_status
  on public.submissions (status)
  where deleted_at is null;

-- ── feedback ─────────────────────────────────────────────────────────────────
create index if not exists idx_feedback_submission
  on public.feedback (submission_id)
  where deleted_at is null;

create index if not exists idx_feedback_published
  on public.feedback (published, published_at)
  where deleted_at is null;

-- ── judges + judge_scores ────────────────────────────────────────────────────
create index if not exists idx_judges_edition_active
  on public.judges (edition_id, is_active);

create index if not exists idx_judge_scores_submission
  on public.judge_scores (submission_id)
  where deleted_at is null;

create index if not exists idx_judge_scores_judge
  on public.judge_scores (judge_id)
  where deleted_at is null;

-- ── tokens ───────────────────────────────────────────────────────────────────
create index if not exists idx_tokens_edition_dept
  on public.tokens (edition_id, department)
  where deleted_at is null;

-- ── notifications ────────────────────────────────────────────────────────────
create index if not exists idx_notifications_user_read
  on public.notifications (user_id, read, created_at desc)
  where deleted_at is null;

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc)
  where deleted_at is null;

-- ── admin_logs ───────────────────────────────────────────────────────────────
create index if not exists idx_admin_logs_admin
  on public.admin_logs (admin_id, created_at desc);

create index if not exists idx_admin_logs_target
  on public.admin_logs (target_type, target_id, created_at desc);

-- ── editions ─────────────────────────────────────────────────────────────────
create index if not exists idx_editions_active
  on public.editions (is_active)
  where deleted_at is null;
