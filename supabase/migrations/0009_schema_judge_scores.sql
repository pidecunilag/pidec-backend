-- =============================================================================
-- PIDEC 1.0 — 0009: judge_scores
-- =============================================================================
-- Raw per-judge scoring records. Distinct from `feedback` (the consolidated,
-- admin-published evaluation). Stage 1 judges use this to log their Stage 1
-- representative selection and rubric notes; Stage 2 judges use it to enter
-- criterion-by-criterion scores. Admin reviews these before publishing
-- consolidated `feedback` rows.
-- =============================================================================

create table if not exists public.judge_scores (
  id                      uuid primary key default gen_random_uuid(),
  submission_id           uuid not null references public.submissions(id) on delete restrict,
  judge_id                uuid not null references public.judges(id) on delete restrict,
  scores                  jsonb not null default '{}'::jsonb,
  comments                jsonb not null default '{}'::jsonb,
  total_score             numeric(6, 2),
  is_representative_pick  boolean not null default false,  -- Stage 1 only
  submitted_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

-- At most one score row per (judge, submission)
create unique index if not exists idx_judge_scores_unique
  on public.judge_scores (judge_id, submission_id)
  where deleted_at is null;

comment on column public.judge_scores.is_representative_pick is
  'Stage 1 only: set true when the judge selects this team as their department representative.';
