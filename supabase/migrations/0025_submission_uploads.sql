-- =============================================================================
-- PIDEC 1.0 — 0025: Submission upload metadata
-- =============================================================================
-- Private file bytes live in the existing `submissions` Supabase Storage bucket.
-- This table stores the auditable metadata and lets the API validate `fileIds`
-- before Stage 2/3 submissions attach files to `submissions.files`.

create table if not exists public.submission_uploads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  edition_id uuid not null references public.editions(id) on delete restrict,
  stage int not null check (stage in (2, 3)),
  bucket text not null default 'submissions',
  storage_path text not null unique,
  filename text not null,
  size_bytes int not null check (size_bytes > 0),
  mimetype text not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_submission_uploads_team_stage
  on public.submission_uploads (team_id, edition_id, stage)
  where deleted_at is null;

create index if not exists idx_submission_uploads_uploaded_by
  on public.submission_uploads (uploaded_by)
  where deleted_at is null;

comment on table public.submission_uploads is
  'Metadata for Stage 2/3 files uploaded through the API into the private submissions bucket.';
