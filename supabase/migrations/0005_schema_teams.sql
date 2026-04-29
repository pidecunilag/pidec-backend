-- =============================================================================
-- PIDEC 1.0 — 0005: teams
-- =============================================================================
-- A team belongs to one department and one edition. Name uniqueness scoped to
-- the edition so that PIDEC 2.0 can reuse names without conflict.
-- =============================================================================

create table if not exists public.teams (
  id                          uuid primary key default gen_random_uuid(),
  edition_id                  uuid not null references public.editions(id) on delete restrict,
  name                        text not null,
  department                  text not null,
  leader_id                   uuid not null references public.users(id) on delete restrict,
  current_stage               smallint not null default 1
                                check (current_stage between 1 and 3),
  status                      team_status not null default 'active',
  disqualified_at_stage       smallint
                                check (disqualified_at_stage is null
                                       or disqualified_at_stage between 1 and 3),
  disqualified_at             timestamptz,
  disqualified_reason         text,
  is_stage_2_representative   boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

-- Team name unique within an edition (ignoring soft-deleted rows)
create unique index if not exists idx_teams_name_per_edition_unique
  on public.teams (edition_id, lower(name))
  where deleted_at is null;

-- Only one representative team per (department, edition) for Stage 2
create unique index if not exists idx_teams_rep_per_dept_unique
  on public.teams (edition_id, department)
  where is_stage_2_representative = true and deleted_at is null;

-- Resolve the FK from users.team_id → teams.id now that teams exists
alter table public.users
  drop constraint if exists users_team_id_fkey;
alter table public.users
  add constraint users_team_id_fkey
    foreign key (team_id) references public.teams(id) on delete set null;

comment on column public.teams.is_stage_2_representative is
  'True once a judge selects this team as the representative for their department.';
