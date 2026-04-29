-- =============================================================================
-- PIDEC 1.0 — 0011: tokens (Stage 1 department submission tokens)
-- =============================================================================
-- 12-character cryptographically random alphanumeric tokens, scoped per
-- department. Distributed by admin to department reps. Required to unlock the
-- Stage 1 submission form. Token use is tracked (use_count, last_used_at)
-- but a single token may be used by multiple teams within the department.
-- =============================================================================

create table if not exists public.tokens (
  id                  uuid primary key default gen_random_uuid(),
  edition_id          uuid not null references public.editions(id) on delete restrict,
  department          text not null,
  token_string        text not null,
  expires_at          timestamptz,
  use_count           integer not null default 0,
  last_used_at        timestamptz,
  created_by          uuid not null references public.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Token string globally unique (active rows only)
create unique index if not exists idx_tokens_string_unique
  on public.tokens (token_string)
  where deleted_at is null;

-- One active token per (edition, department) at a time. Regeneration soft-
-- deletes the old token and inserts a new one.
create unique index if not exists idx_tokens_active_per_dept_unique
  on public.tokens (edition_id, department)
  where deleted_at is null;

-- Defence-in-depth: token string is exactly 12 alphanumeric characters
alter table public.tokens
  drop constraint if exists tokens_format_chk;
alter table public.tokens
  add constraint tokens_format_chk
    check (token_string ~ '^[A-Za-z0-9]{12}$');

-- Resolve submissions.token_id FK now that tokens exists
alter table public.submissions
  drop constraint if exists submissions_token_id_fkey;
alter table public.submissions
  add constraint submissions_token_id_fkey
    foreign key (token_id) references public.tokens(id) on delete set null;
