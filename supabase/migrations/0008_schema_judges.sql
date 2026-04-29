-- =============================================================================
-- PIDEC 1.0 — 0008: judges
-- =============================================================================
-- A judge is a platform user with role='judge'. This table stores the judge-
--specific metadata: stage scope, assigned departments, activation state.
--FK target for judges.id is aligned to public.users in migration 0018.
-- =============================================================================

create table if not exists public.judges (
  id                        uuid primary key references auth.users(id) on delete cascade,
  edition_id                uuid not null references public.editions(id) on delete restrict,
  name                      text not null,
  email                     citext not null,
  stage_scope               judge_stage_scope not null,
  assigned_departments      text[] not null default array[]::text[],
  is_active                 boolean not null default true,
  created_by                uuid not null references public.users(id) on delete restrict,
  deactivated_at            timestamptz,
  deactivated_by            uuid references public.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists idx_judges_email_per_edition
  on public.judges (edition_id, email);

-- Defence-in-depth: at least one assigned department while active
alter table public.judges
  drop constraint if exists judges_depts_not_empty_when_active_chk;
alter table public.judges
  add constraint judges_depts_not_empty_when_active_chk
    check (is_active = false or array_length(assigned_departments, 1) >= 1);

comment on column public.judges.assigned_departments is
  'Text array of department names the judge can score. Must be non-empty while active.';
