-- =============================================================================
-- PIDEC 1.0 — 0006: team_invites
-- =============================================================================
-- 48-hour invite system. Only one pending invite per (team, invitee) at a time.
-- Expiry is enforced at the API layer (and via a background sweep worker) —
-- the DB stores expires_at as the source of truth.
-- =============================================================================

create table if not exists public.team_invites (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  invitee_id        uuid not null references public.users(id) on delete cascade,
  invited_by        uuid not null references public.users(id) on delete restrict,
  status            invite_status not null default 'pending',
  expires_at        timestamptz not null,
  responded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- At most one pending invite per (team, invitee) at a time
create unique index if not exists idx_team_invites_pending_unique
  on public.team_invites (team_id, invitee_id)
  where status = 'pending' and deleted_at is null;
