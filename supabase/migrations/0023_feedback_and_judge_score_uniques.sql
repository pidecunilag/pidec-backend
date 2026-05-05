-- =============================================================================
-- PIDEC 1.0 — 0023: feedback + judge score uniqueness
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_submission_unique
  ON public.feedback(submission_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_judge_scores_unique
  ON public.judge_scores(judge_id, submission_id)
  WHERE deleted_at IS NULL;
