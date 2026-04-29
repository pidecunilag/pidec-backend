-- Migration: Add verification and password reset tokens
-- Purpose: Support email verification and password reset flows
-- Created: Phase 4

-- ── Verification Tokens ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE, -- Hashed token (to avoid exposing it if table is compromised)
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at)
  WHERE used_at IS NULL; -- For cleanup queries

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_tokens_one_active_per_user
  ON public.email_verification_tokens(user_id)
  WHERE used_at IS NULL;

-- ── Password Reset Tokens ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE, -- Hashed token
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at)
  WHERE used_at IS NULL; -- For cleanup queries

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_one_active_per_user
  ON public.password_reset_tokens(user_id)
  WHERE used_at IS NULL;

-- ── RLS Policies ────────────────────────────────────────────────
-- (Tokens are verified server-side only; no client access needed)
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only
DROP POLICY IF EXISTS "Service role can manage email verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Service role can manage email verification tokens"
  ON public.email_verification_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Service role can manage password reset tokens"
  ON public.password_reset_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
