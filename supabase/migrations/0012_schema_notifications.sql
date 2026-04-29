-- =============================================================================
-- PIDEC 1.0 — 0012: notifications
-- =============================================================================
-- In-platform notifications. Delivered via Supabase Realtime to the user's
-- own dashboard (RLS restricts SELECT/UPDATE to user_id = auth.uid()).
-- =============================================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  type            notification_type not null,
  title           text not null,
  message         text not null,
  action_url      text,
  metadata        jsonb not null default '{}'::jsonb,
  read            boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- read=true requires read_at to be set
alter table public.notifications
  drop constraint if exists notifications_read_consistency_chk;
alter table public.notifications
  add constraint notifications_read_consistency_chk
    check ((read = false and read_at is null) or (read = true and read_at is not null));
