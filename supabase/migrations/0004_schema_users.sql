-- =============================================================================
-- PIDEC 1.0 — 0004: users (profile table)
-- =============================================================================
-- Public-facing user profile table.
-- NOTE: custom auth alignment is applied in 0018_custom_auth_admin_seed.sql,
-- including password_hash and removal of auth.users FK dependency.
-- =============================================================================

create table if not exists public.users (
  id                        uuid primary key references auth.users(id) on delete cascade,
  name                      text not null,
  email                     citext not null,
  matric_number             text not null,
  department                text not null,
  level                     smallint not null check (level in (100, 200, 300, 400, 500)),
  verification_status       verification_status not null default 'pending',
  verification_method       verification_method,
  verification_timestamp    timestamptz,
  verification_attempts     smallint not null default 0,
  last_verification_attempt_at  timestamptz,
  is_suspended              boolean not null default false,
  suspended_at              timestamptz,
  suspension_reason         text,
  team_id                   uuid,  -- FK added after teams table is created (0005)
  role                      text not null default 'student'
                              check (role in ('student', 'admin', 'judge')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

-- Unique constraints that ignore soft-deleted rows
create unique index if not exists idx_users_email_unique
  on public.users (email)
  where deleted_at is null;

create unique index if not exists idx_users_matric_unique
  on public.users (matric_number)
  where deleted_at is null;

-- Matric number format guard: 9 digits. Full business rules (YY range, FF=04)
-- are enforced at API layer via Zod — this is a defence-in-depth check.
alter table public.users
  drop constraint if exists users_matric_format_chk;
alter table public.users
  add constraint users_matric_format_chk
    check (matric_number ~ '^[0-9]{9}$');

comment on table  public.users is 'Student / admin / judge profiles for PIDEC custom auth.';
comment on column public.users.role is
  'Determines which portal the user sees on login. Admin is set manually post-signup.';
comment on column public.users.team_id is
  'FK to teams.id — constraint added in 0005_schema_teams.sql to resolve cyclical dependency.';
