-- =============================================================================
-- PIDEC 1.0 - Idempotent Grand Finale reminder delivery tracking
-- =============================================================================

create table if not exists public.finale_reminder_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references public.finale_registrations(id) on delete cascade,
  reminder_key        text not null,
  status              text not null default 'pending',
  provider_id         text,
  attempt_count       integer not null default 1,
  claimed_at          timestamptz not null default now(),
  sent_at             timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint finale_reminder_key_chk check (reminder_key in ('3-days', '2-days', '1-day', 'event-day')),
  constraint finale_reminder_status_chk check (status in ('pending', 'sent', 'failed')),
  constraint finale_reminder_delivery_unique unique (registration_id, reminder_key)
);

drop trigger if exists trg_finale_reminder_deliveries_updated_at on public.finale_reminder_deliveries;
create trigger trg_finale_reminder_deliveries_updated_at
  before update on public.finale_reminder_deliveries
  for each row execute function public.set_updated_at();

create index if not exists idx_finale_reminder_deliveries_status
  on public.finale_reminder_deliveries (reminder_key, status, claimed_at);

alter table public.finale_reminder_deliveries enable row level security;

create or replace function public.claim_finale_reminder_recipients(
  p_reminder_key text,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  registration_id uuid,
  registration_number text,
  full_name text,
  email citext
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reminder_key not in ('3-days', '2-days', '1-day', 'event-day') then
    raise exception 'Invalid finale reminder key';
  end if;

  return query
  with eligible as (
    select r.id
    from public.finale_registrations r
    left join public.finale_reminder_deliveries d
      on d.registration_id = r.id and d.reminder_key = p_reminder_key
    where d.id is null
       or (d.status = 'failed' and d.claimed_at < now() - interval '10 minutes')
       or (d.status = 'pending' and d.claimed_at < now() - interval '30 minutes')
    order by r.created_at
    limit greatest(1, least(p_limit, 500))
  ), claimed as (
    insert into public.finale_reminder_deliveries (
      registration_id,
      reminder_key,
      status,
      attempt_count,
      claimed_at,
      last_error
    )
    select e.id, p_reminder_key, 'pending', 1, now(), null
    from eligible e
    on conflict (registration_id, reminder_key) do update
      set status = 'pending',
          attempt_count = public.finale_reminder_deliveries.attempt_count + 1,
          claimed_at = now(),
          last_error = null
      where public.finale_reminder_deliveries.status = 'failed'
         or (
           public.finale_reminder_deliveries.status = 'pending'
           and public.finale_reminder_deliveries.claimed_at < now() - interval '30 minutes'
         )
    returning id, registration_id
  )
  select
    c.id,
    r.id,
    r.registration_number,
    r.full_name,
    r.email
  from claimed c
  join public.finale_registrations r on r.id = c.registration_id;
end;
$$;

revoke all on function public.claim_finale_reminder_recipients(text, integer) from public;
revoke all on function public.claim_finale_reminder_recipients(text, integer) from anon, authenticated;
grant execute on function public.claim_finale_reminder_recipients(text, integer) to service_role;

comment on table public.finale_reminder_deliveries is
  'Tracks Grand Finale reminder claims and delivery outcomes to prevent duplicate emails.';
