-- =============================================================================
-- PIDEC 1.0 — 0003: editions
-- =============================================================================
-- An edition represents a single run of the PIDEC competition (1.0, 2.0, ...).
-- All other entities (teams, submissions, tokens) are scoped to an edition.
-- Exactly one edition should be "active" at a time (enforced by partial unique
-- index below — multiple editions can exist but only one active).
-- =============================================================================

create table if not exists public.editions (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  theme                     text,
  active_stage              smallint not null default 0
                              check (active_stage between 0 and 3),
  signup_open               boolean not null default false,
  team_management_locked    boolean not null default false,
  submission_window_open    boolean not null default false,
  is_active                 boolean not null default false,
  announcement_banner       text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

-- Only one active edition at a time
create unique index if not exists idx_editions_single_active
  on public.editions (is_active)
  where is_active = true and deleted_at is null;

comment on column public.editions.active_stage is
  '0 = pre-launch, 1/2/3 = active competition stage';
comment on column public.editions.is_active is
  'Exactly one edition may be is_active=true at a time (enforced by unique partial index)';
