-- =============================================================================
-- PIDEC 1.0 — 0010: feedback
-- =============================================================================
-- The consolidated, admin-published evaluation per submission. Composed from
-- one or more judge_scores rows. Visible to teams only when published=true.
-- One feedback row per submission (active rows only).
-- =============================================================================

create table if not exists public.feedback (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null references public.submissions(id) on delete restrict,
  scores              jsonb not null default '{}'::jsonb,
  comments            jsonb not null default '{}'::jsonb,
  total_score         numeric(6, 2),
  outcome             text check (outcome in ('advanced', 'not_advanced', 'pending')),
  published           boolean not null default false,
  published_at        timestamptz,
  published_by        uuid references public.users(id),
  entered_by_admin    uuid not null references public.users(id) on delete restrict,
  evaluator_name      text,
  evaluation_date     date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- One feedback row per submission (active rows only)
create unique index if not exists idx_feedback_submission_unique
  on public.feedback (submission_id)
  where deleted_at is null;

-- published=true requires published_at + published_by to be set
alter table public.feedback
  drop constraint if exists feedback_published_consistency_chk;
alter table public.feedback
  add constraint feedback_published_consistency_chk
    check (
      (published = false)
      or (published = true and published_at is not null and published_by is not null)
    );

comment on column public.feedback.outcome is
  'Stage outcome for this team: advanced (proceeds to next stage), not_advanced, or pending.';
