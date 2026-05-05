-- =============================================================================
-- PIDEC 1.0 — 0022: Refresh sessions + atomic invite response
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id
  ON public.refresh_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expires_at
  ON public.refresh_sessions(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.refresh_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage refresh sessions" ON public.refresh_sessions;
CREATE POLICY "Service role can manage refresh sessions"
  ON public.refresh_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.respond_team_invite(
  p_invite_id uuid,
  p_invitee_id uuid,
  p_status invite_status
)
RETURNS TABLE (
  invite_id uuid,
  invite_status invite_status,
  team_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.team_invites%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_member_count integer;
  v_now timestamptz := now();
BEGIN
  IF p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid invite response status';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.team_invites
  WHERE id = p_invite_id
    AND invitee_id = p_invitee_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'invite is no longer pending';
  END IF;

  IF v_invite.expires_at < v_now THEN
    UPDATE public.team_invites
    SET status = 'expired',
        responded_at = v_now,
        updated_at = v_now
    WHERE id = v_invite.id;
    RAISE EXCEPTION 'invite has expired';
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_invitee_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF p_status = 'accepted' THEN
    IF v_user.team_id IS NOT NULL THEN
      RAISE EXCEPTION 'user already belongs to a team';
    END IF;

    SELECT *
    INTO v_team
    FROM public.teams
    WHERE id = v_invite.team_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'team not found';
    END IF;

    SELECT count(*)
    INTO v_member_count
    FROM public.users AS team_members
    WHERE team_members.team_id = v_team.id
      AND team_members.deleted_at IS NULL;

    IF v_member_count >= 6 THEN
      RAISE EXCEPTION 'team is full';
    END IF;

    UPDATE public.users
    SET team_id = v_team.id,
        updated_at = v_now
    WHERE id = p_invitee_id;
  END IF;

  UPDATE public.team_invites
  SET status = p_status,
      responded_at = v_now,
      updated_at = v_now
  WHERE id = v_invite.id;

  RETURN QUERY
  SELECT v_invite.id, p_status, v_invite.team_id;
END;
$$;

COMMENT ON FUNCTION public.respond_team_invite(uuid, uuid, invite_status) IS
  'Atomically responds to a team invite, including capacity checks and team assignment for accepted invites.';
