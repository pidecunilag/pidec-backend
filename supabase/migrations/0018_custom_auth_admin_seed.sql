-- =============================================================================
-- PIDEC 1.0 — 0018: Custom auth alignment + initial admin seeding helper
-- =============================================================================
-- Context:
--   PIDEC is using its own auth system (JWT + password hash in app layer),
--   not Supabase Auth users for identity.
--
-- This migration:
--   1) Removes hard dependency on auth.users IDs.
--   2) Adds password_hash to public.users for custom auth credentials.
--   3) Adds a single-admin guard (one active admin at a time).
--   4) Adds a secure SQL helper to seed/update the initial admin account.
-- =============================================================================

-- 1) Remove fallback trigger that mirrored auth.users -> public.users
drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

-- 2) Drop FK from public.users.id -> auth.users(id)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.users drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.users
  alter column id set default gen_random_uuid();

-- 3) Drop FK from public.judges.id -> auth.users(id), then point to public.users
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.judges'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.judges drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.judges
  add constraint judges_id_fkey
  foreign key (id) references public.users(id) on delete cascade;

-- 4) Add credential column for custom auth
alter table public.users
  add column if not exists password_hash text;

comment on column public.users.password_hash is
  'Bcrypt hash for custom PIDEC auth. Never return in API responses.';

-- 5) Single active admin guard (matches PRD single-admin requirement)
create unique index if not exists idx_users_single_admin
  on public.users ((role))
  where role = 'admin' and deleted_at is null;

-- 6) Seed helper
create or replace function public.seed_initial_admin(
  p_email citext,
  p_password_hash text,
  p_name text default 'PIDEC Admin'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_admin uuid;
  v_admin_id uuid;
begin
  if p_email is null or length(trim(p_email::text)) = 0 then
    raise exception 'admin email is required';
  end if;

  if p_password_hash is null or p_password_hash !~ '^\\$2[aby]\\$[0-9]{2}\\$' then
    raise exception 'password hash must be a valid bcrypt hash';
  end if;

  select id
  into v_existing_admin
  from public.users
  where role = 'admin'
    and deleted_at is null
    and email <> p_email
  limit 1;

  if v_existing_admin is not null then
    raise exception 'an active admin already exists with a different email';
  end if;

  insert into public.users (
    id,
    name,
    email,
    matric_number,
    department,
    level,
    verification_status,
    role,
    password_hash,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    left(trim(coalesce(p_name, 'PIDEC Admin')), 120),
    p_email,
    '000000001',
    'ADMIN',
    500,
    'verified',
    'admin',
    p_password_hash,
    now(),
    now()
  )
  on conflict (email)
  where deleted_at is null
  do update set
    name = excluded.name,
    role = 'admin',
    verification_status = 'verified',
    is_suspended = false,
    suspended_at = null,
    suspension_reason = null,
    password_hash = excluded.password_hash,
    updated_at = now()
  returning id into v_admin_id;

  return v_admin_id;
end;
$$;

comment on function public.seed_initial_admin(citext, text, text) is
  'Creates or updates the single active admin account for custom auth. Expects bcrypt hash.';
