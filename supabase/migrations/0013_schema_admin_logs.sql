-- =============================================================================
-- PIDEC 1.0 — 0013: admin_logs (append-only audit trail)
-- =============================================================================
-- Every admin action is recorded here with before/after JSON snapshots.
-- This table is APPEND-ONLY: no UPDATE policy, no DELETE policy, no
-- deleted_at column. Even the service role MUST NOT mutate existing rows
-- (we just don't expose a code path that does).
-- =============================================================================

create table if not exists public.admin_logs (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references public.users(id) on delete restrict,
  action          admin_log_action not null,
  target_type     text not null,
  target_id       uuid,
  before_value    jsonb,
  after_value     jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- Defence-in-depth: prevent UPDATE and DELETE on admin_logs at the table level
-- via a trigger. RLS would handle this for non-service-role queries, but the
-- service role bypasses RLS, so we add a hard guard here.
create or replace function public.admin_logs_block_mutations()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_logs is append-only — % is not permitted', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_admin_logs_block_update on public.admin_logs;
create trigger trg_admin_logs_block_update
  before update on public.admin_logs
  for each row
  execute function public.admin_logs_block_mutations();

drop trigger if exists trg_admin_logs_block_delete on public.admin_logs;
create trigger trg_admin_logs_block_delete
  before delete on public.admin_logs
  for each row
  execute function public.admin_logs_block_mutations();

comment on table public.admin_logs is 'Append-only audit log. Triggers block UPDATE/DELETE at the row level.';
