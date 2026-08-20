-- =============================================================================
-- PIDEC 1.0 - Grand Finale registrations and admission tracking
-- =============================================================================

alter type public.admin_log_action add value if not exists 'finale_admit';
alter type public.admin_log_action add value if not exists 'finale_unadmit';

create sequence if not exists public.finale_registration_number_seq start with 1;

create table if not exists public.finale_registrations (
  id                    uuid primary key default gen_random_uuid(),
  registration_number   text not null unique,
  full_name             text not null,
  email                 citext not null unique,
  phone                 text not null unique,
  admitted_at           timestamptz,
  admitted_by           uuid references public.users(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint finale_registrations_name_chk check (char_length(btrim(full_name)) between 2 and 120),
  constraint finale_registrations_phone_chk check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint finale_registrations_admission_chk check (
    (admitted_at is null and admitted_by is null) or
    (admitted_at is not null and admitted_by is not null)
  )
);

create or replace function public.set_finale_registration_number()
returns trigger
language plpgsql
as $$
begin
  if new.registration_number is null or btrim(new.registration_number) = '' then
    new.registration_number := 'PIDEC26-' ||
      lpad(nextval('public.finale_registration_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finale_registration_number on public.finale_registrations;
create trigger trg_finale_registration_number
  before insert on public.finale_registrations
  for each row execute function public.set_finale_registration_number();

drop trigger if exists trg_finale_registrations_updated_at on public.finale_registrations;
create trigger trg_finale_registrations_updated_at
  before update on public.finale_registrations
  for each row execute function public.set_updated_at();

create index if not exists idx_finale_registrations_created_at
  on public.finale_registrations (created_at desc);
create index if not exists idx_finale_registrations_admitted_at
  on public.finale_registrations (admitted_at);

alter table public.finale_registrations enable row level security;

comment on table public.finale_registrations is
  'Public PIDEC 1.0 Grand Finale registrations. Access is only through the service-role API.';
