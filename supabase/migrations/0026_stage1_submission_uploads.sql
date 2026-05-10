-- =============================================================================
-- PIDEC 1.0 - 0026: Stage 1 document proposal uploads
-- =============================================================================
-- Stage 1 proposals now use the same private submission upload pipeline as
-- later stages, with API-level validation limiting Stage 1 files to PDF/Word.

alter table public.submission_uploads
  drop constraint if exists submission_uploads_stage_check;

alter table public.submission_uploads
  add constraint submission_uploads_stage_check
  check (stage in (1, 2, 3));

comment on table public.submission_uploads is
  'Metadata for Stage 1/2/3 files uploaded through the API into the private submissions bucket.';
