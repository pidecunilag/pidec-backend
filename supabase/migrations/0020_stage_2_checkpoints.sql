-- Migration: Stage 2 checkpoints
-- Purpose: Admin-managed checkpoint schedule for Stage 2 progress tracking

CREATE TABLE IF NOT EXISTS public.stage_2_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  stage smallint NOT NULL DEFAULT 2 CHECK (stage = 2),
  title text NOT NULL,
  description text,
  due_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stage_2_checkpoints_edition_id
  ON public.stage_2_checkpoints(edition_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stage_2_checkpoints_sort_order
  ON public.stage_2_checkpoints(edition_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stage_2_checkpoints_due_at
  ON public.stage_2_checkpoints(due_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.stage_2_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage stage 2 checkpoints" ON public.stage_2_checkpoints;
CREATE POLICY "Service role can manage stage 2 checkpoints"
  ON public.stage_2_checkpoints
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
