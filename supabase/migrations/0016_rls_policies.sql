-- =============================================================================
-- PIDEC 1.0 — 0016: Row Level Security (RLS) policies
-- =============================================================================
-- Enable RLS on every table. Frontend uses the anon (and authenticated) key,
-- so it only sees rows these policies expose. The backend uses the service
-- role key, which BYPASSES RLS — all writes flow through use cases that
-- enforce business rules at the application layer.
--
-- Convention for re-runnability: drop policy if exists, then create.
-- =============================================================================

-- ── editions ─────────────────────────────────────────────────────────────────
alter table public.editions enable row level security;

drop policy if exists "editions: read all" on public.editions;
create policy "editions: read all"
  on public.editions
  for select
  using (deleted_at is null);

-- No INSERT/UPDATE/DELETE policies — service role only.

-- ── users ────────────────────────────────────────────────────────────────────
alter table public.users enable row level security;

drop policy if exists "users: read own row" on public.users;
create policy "users: read own row"
  on public.users
  for select
  using (auth.uid() = id and deleted_at is null);

drop policy if exists "users: read teammates" on public.users;
create policy "users: read teammates"
  on public.users
  for select
  using (
    deleted_at is null
    and team_id is not null
    and team_id in (
      select u.team_id from public.users u
      where u.id = auth.uid() and u.deleted_at is null
    )
  );

-- ── teams ────────────────────────────────────────────────────────────────────
alter table public.teams enable row level security;

drop policy if exists "teams: read own team" on public.teams;
create policy "teams: read own team"
  on public.teams
  for select
  using (
    deleted_at is null
    and id in (
      select u.team_id from public.users u
      where u.id = auth.uid() and u.deleted_at is null
    )
  );

-- ── team_invites ─────────────────────────────────────────────────────────────
alter table public.team_invites enable row level security;

drop policy if exists "invites: invitee reads own" on public.team_invites;
create policy "invites: invitee reads own"
  on public.team_invites
  for select
  using (deleted_at is null and invitee_id = auth.uid());

drop policy if exists "invites: leader reads team's" on public.team_invites;
create policy "invites: leader reads team's"
  on public.team_invites
  for select
  using (
    deleted_at is null
    and team_id in (
      select t.id from public.teams t
      where t.leader_id = auth.uid() and t.deleted_at is null
    )
  );

-- ── submissions ──────────────────────────────────────────────────────────────
alter table public.submissions enable row level security;

drop policy if exists "submissions: team members read" on public.submissions;
create policy "submissions: team members read"
  on public.submissions
  for select
  using (
    deleted_at is null
    and team_id in (
      select u.team_id from public.users u
      where u.id = auth.uid() and u.deleted_at is null
    )
  );

-- ── feedback ─────────────────────────────────────────────────────────────────
alter table public.feedback enable row level security;

drop policy if exists "feedback: team reads when published" on public.feedback;
create policy "feedback: team reads when published"
  on public.feedback
  for select
  using (
    deleted_at is null
    and published = true
    and submission_id in (
      select s.id from public.submissions s
      where s.deleted_at is null
        and s.team_id in (
          select u.team_id from public.users u
          where u.id = auth.uid() and u.deleted_at is null
        )
    )
  );

-- ── judges ───────────────────────────────────────────────────────────────────
alter table public.judges enable row level security;

drop policy if exists "judges: read own row" on public.judges;
create policy "judges: read own row"
  on public.judges
  for select
  using (id = auth.uid());

-- ── judge_scores ─────────────────────────────────────────────────────────────
alter table public.judge_scores enable row level security;

drop policy if exists "judge_scores: judge reads own" on public.judge_scores;
create policy "judge_scores: judge reads own"
  on public.judge_scores
  for select
  using (deleted_at is null and judge_id = auth.uid());

-- ── tokens ───────────────────────────────────────────────────────────────────
alter table public.tokens enable row level security;
-- No anon/authenticated policies. Service role only — tokens are distributed
-- via admin console; team leaders enter them in the submission form which
-- validates server-side.

-- ── notifications ────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications
  for select
  using (deleted_at is null and user_id = auth.uid());

drop policy if exists "notifications: update own (mark read)" on public.notifications;
create policy "notifications: update own (mark read)"
  on public.notifications
  for update
  using (deleted_at is null and user_id = auth.uid())
  with check (deleted_at is null and user_id = auth.uid());

-- ── admin_logs ───────────────────────────────────────────────────────────────
alter table public.admin_logs enable row level security;
-- No policies. Service role only.

-- =============================================================================
-- Realtime: enable for notifications so dashboards can subscribe live
-- =============================================================================
do $$
begin
  -- Add notifications to the supabase_realtime publication if not already there
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception when undefined_object then
  -- supabase_realtime publication doesn't exist yet (fresh project) — skip.
  null;
end $$;
