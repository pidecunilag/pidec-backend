-- =============================================================================
-- PIDEC 1.0 — 0007: submissions
-- =============================================================================
-- One submission per team per stage per edition (enforced by partial unique
-- index that ignores soft-deleted rows). form_data is jsonb — Stage 1 holds
-- sectioned proposal text, Stage 2 holds documentation metadata + video link,
-- Stage 3 holds final docs + presentation slide metadata.
-- Actual file bytes live in Supabase Storage — `files` is an array of
-- references: [{ url, filename, size_bytes, mimetype, uploaded_at }].
-- =============================================================================

create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references public.teams(id) on delete restrict,
  edition_id          uuid not null references public.editions(id) on delete restrict,
  submitted_by        uuid not null references public.users(id) on delete restrict,
  stage               smallint not null check (stage between 1 and 3),
  form_data           jsonb not null default '{}'::jsonb,
  files               jsonb not null default '[]'::jsonb,
  video_link          text,
  status              submission_status not null default 'submitted',
  is_locked           boolean not null default true,
  token_id            uuid, -- Stage 1 only; FK added in 0011_schema_tokens.sql
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- One submission per (team, edition, stage) — ignoring soft-deleted rows
create unique index if not exists idx_submissions_unique
  on public.submissions (team_id, edition_id, stage)
  where deleted_at is null;

-- Defence-in-depth: files must be an array
alter table public.submissions
  drop constraint if exists submissions_files_is_array_chk;
alter table public.submissions
  add constraint submissions_files_is_array_chk
    check (jsonb_typeof(files) = 'array');

-- Defence-in-depth: form_data must be an object
alter table public.submissions
  drop constraint if exists submissions_form_data_is_object_chk;
alter table public.submissions
  add constraint submissions_form_data_is_object_chk
    check (jsonb_typeof(form_data) = 'object');

comment on column public.submissions.is_locked is
  'Once true the team can no longer edit. Set true on submit. Admin can unlock for authorised resubmission.';
comment on column public.submissions.token_id is
  'Stage 1 only: references the department submission token that unlocked this submission.';
