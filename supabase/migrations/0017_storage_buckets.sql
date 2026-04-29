-- =============================================================================
-- PIDEC 1.0 — 0017: Storage buckets
-- =============================================================================
-- Two buckets, merged at the API layer:
--   submissions    — private, holds Stage 2/3 documentation files
--   public-assets  — public, holds sponsor/partner logos and landing media
--
-- Verification documents are NEVER written to storage. The buffer lives in
-- Redis (60s TTL) and is discarded after AI extraction.
--
-- ────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS NOTE
-- ────────────────────────────────────────────────────────────────────────────
-- `storage.objects` is owned by the `supabase_storage_admin` role, so the
-- standard postgres role (used by the SQL editor) cannot run
-- `alter table storage.objects ...` or `create policy ... on storage.objects`.
--
-- We don't need those statements:
--   • public-assets is `public = true` → readable via public URL with NO
--     policy required. Supabase serves it directly.
--   • submissions is `public = false` and has NO anon policies → all access
--     is blocked for the anon/authenticated roles. Only the service-role
--     client (used by our backend) can read/write, which is exactly what
--     we want — every upload flows through the API after MIME-magic-byte
--     validation.
--
-- If you ever need an additional storage policy (e.g. to let team members
-- download their own submission directly), create it via the Supabase
-- Dashboard → Storage → Policies UI, NOT via the SQL editor.
-- =============================================================================

-- ── Bucket: submissions (private) ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  52428800,  -- 50 MB per file
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Bucket: public-assets (public) ───────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-assets',
  'public-assets',
  true,
  5242880,   -- 5 MB per file
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── That's it — no RLS statements required ──────────────────────────────────
-- Buckets are created. Public bucket serves directly. Private bucket is
-- locked to the service role automatically. Done.
