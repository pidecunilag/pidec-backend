-- =============================================================================
-- PIDEC 1.0 — 0015: Triggers (updated_at auto-bump + handle_new_user safety net)
-- =============================================================================

-- ── updated_at auto-bump ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to every table that has an updated_at column
do $$
declare
  t text;
begin
  for t in
    select format('%I.%I', table_schema, table_name)
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updated_at'
      and table_name in (
        'editions','users','teams','team_invites','submissions',
        'judges','judge_scores','feedback','tokens'
      )
  loop
    execute format('drop trigger if exists trg_%s_updated_at on %s',
                   replace(t, 'public.', ''), t);
    execute format(
      'create trigger trg_%s_updated_at before update on %s
       for each row execute function public.set_updated_at()',
       replace(t, 'public.', ''), t
    );
  end loop;
end $$;

-- ── handle_new_user safety net ───────────────────────────────────────────────
-- Primary signup flow goes through the backend (POST /auth/register) which
-- creates auth.users via the admin API and inserts the public.users row in
-- the same transaction. This trigger is a defensive fallback so that if
-- auth.users gets a row inserted by any other path (future OAuth, manual
-- insert, etc.), a skeleton public.users row is created.
--
-- It pulls profile fields from raw_user_meta_data when present, otherwise
-- inserts placeholders the application can fill in later.
-- =============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.users (
    id,
    name,
    email,
    matric_number,
    department,
    level,
    role
  )
  values (
    new.id,
    coalesce(meta->>'name', ''),
    new.email,
    coalesce(meta->>'matric_number', ''),
    coalesce(meta->>'department', ''),
    coalesce(nullif(meta->>'level', '')::smallint, 100),
    coalesce(meta->>'role', 'student')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user is
  'Safety-net trigger: inserts a public.users skeleton row whenever an auth.users row is created. Idempotent via on conflict do nothing.';
