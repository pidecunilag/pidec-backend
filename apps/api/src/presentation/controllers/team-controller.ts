import { type RequestHandler } from 'express';
import { ERROR_CODES, INVITE_LIMITS, TEAM_LIMITS } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';

const getUserProfile = async (userId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('User profile not found');
  return data;
};

const getTeamMembers = async (teamId: string) => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email')
    .eq('team_id', teamId)
    .is('deleted_at', null);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; email: string }>;
};

const respondInviteWithFallback = async (
  inviteId: string,
  inviteeId: string,
  status: 'accepted' | 'declined',
) => {
  const supabase = getSupabaseService() as any;
  const { data: invite, error: inviteError } = await supabase
    .from('team_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('invitee_id', inviteeId)
    .is('deleted_at', null)
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) throw AppError.notFound('Invite not found');
  if (invite.status !== 'pending') throw AppError.validation('Invite is no longer pending');

  const now = new Date().toISOString();
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await supabase
      .from('team_invites')
      .update({ status: 'expired', responded_at: now, updated_at: now } as never)
      .eq('id', invite.id);
    throw new AppError(ERROR_CODES.INVITE_EXPIRED, 'Invite has expired');
  }

  if (status === 'accepted') {
    const [{ data: invitee, error: inviteeError }, { data: team, error: teamError }, { count: teamMemberCount, error: teamMemberCountError }] =
      await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('id', inviteeId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('teams')
          .select('*')
          .eq('id', invite.team_id)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', invite.team_id)
          .is('deleted_at', null),
      ]);

    if (inviteeError) throw inviteeError;
    if (teamError) throw teamError;
    if (teamMemberCountError) throw teamMemberCountError;
    if (!invitee) throw AppError.notFound('Invitee not found');
    if (!team) throw AppError.notFound('Team not found');
    if (invitee.team_id) throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You already belong to a team');
    if ((teamMemberCount ?? 0) >= TEAM_LIMITS.MAX_MEMBERS) {
      throw new AppError(ERROR_CODES.TEAM_FULL, 'Team already has the maximum number of members');
    }

    const { data: membershipUpdate, error: membershipError } = await supabase
      .from('users')
      .update({ team_id: team.id, updated_at: now } as never)
      .eq('id', inviteeId)
      .is('team_id', null)
      .select('id,team_id')
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membershipUpdate) {
      throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You already belong to a team');
    }
  }

  const { data: updatedInvite, error: updatedInviteError } = await supabase
    .from('team_invites')
    .update({ status, responded_at: now, updated_at: now } as never)
    .eq('id', invite.id)
    .eq('status', 'pending')
    .select('id,status,team_id')
    .maybeSingle();

  if (updatedInviteError) throw updatedInviteError;
  if (!updatedInvite) {
    if (status === 'accepted') {
      await supabase
        .from('users')
        .update({ team_id: null, updated_at: now } as never)
        .eq('id', inviteeId)
        .eq('team_id', invite.team_id);
    }
    throw AppError.validation('Invite is no longer pending');
  }

  return {
    invite_id: updatedInvite.id,
    invite_status: updatedInvite.status,
  };
};

export const createTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { name } = req.body as { name: string };
    const supabase = getSupabaseService() as any;
    const user = await getUserProfile(req.user.id);

    if (user.is_suspended) throw AppError.forbidden('Suspended users cannot create teams');
    if (user.verification_status !== 'verified') {
      throw new AppError(ERROR_CODES.VERIFICATION_PENDING, 'Only verified users can create teams');
    }
    if (user.team_id) throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You are already in a team');

    const { data: edition, error: editionError } = await supabase
      .from('editions')
      .select('id,team_management_locked')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (editionError) throw editionError;
    if (!edition) throw AppError.notFound('No active edition configured');
    if (edition.team_management_locked) {
      throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked for the active stage');
    }

    const { data: team, error } = await supabase
      .from('teams')
      .insert([
        {
          edition_id: edition.id,
          name,
          department: user.department,
          leader_id: user.id,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ team_id: team.id } as never)
      .eq('id', user.id);

    if (userUpdateError) throw userUpdateError;

    logger.info({ userId: user.id, teamId: team.id }, 'Team created');

    res.status(201).json({
      status: 'success',
      data: { team },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const supabase = getSupabaseService() as any;
    const user = await getUserProfile(req.user.id);

    if (!user.team_id) {
      return res.status(200).json({
        status: 'success',
        data: { team: null, members: [] },
      });
    }

    const [{ data: team, error: teamError }, { data: members, error: membersError }] =
      await Promise.all([
        supabase
          .from('teams')
          .select('*')
          .eq('id', user.team_id)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('users')
          .select('id,name,email,role,verification_status')
          .eq('team_id', user.team_id)
          .is('deleted_at', null),
      ]);

    if (teamError) throw teamError;
    if (membersError) throw membersError;

    return res.status(200).json({
      status: 'success',
      data: {
        team,
        members: members ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
};

export const searchTeammates: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { query } = req.query as { query: string };

    const supabase = getSupabaseService() as any;
    const user = await getUserProfile(req.user.id);

    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,department,verification_status')
      .ilike('name', `%${query}%`)
      .eq('department', user.department)
      .is('team_id', null)
      .eq('verification_status', 'verified')
      .is('deleted_at', null)
      .neq('id', user.id)
      .limit(20);

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { results: data ?? [] },
    });
  } catch (err) {
    next(err);
  }
};

export const listMyInvites: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const supabase = getSupabaseService() as any;

    const { error: expireError } = await supabase
      .from('team_invites')
      .update({ status: 'expired', responded_at: new Date().toISOString() } as never)
      .eq('invitee_id', req.user.id)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (expireError) throw expireError;

    const { data, error } = await supabase
      .from('team_invites')
      .select('*, teams(id,name,department), users!team_invites_invited_by_fkey(id,name,email)')
      .eq('invitee_id', req.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { invites: data ?? [] },
    });
  } catch (err) {
    next(err);
  }
};

export const sendInvite: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { inviteeId } = req.body as { inviteeId: string };
    const supabase = getSupabaseService() as any;
    const sender = await getUserProfile(req.user.id);

    if (!sender.team_id) throw AppError.validation('You must belong to a team to invite members');

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', sender.team_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) throw AppError.notFound('Team not found');
    if (team.leader_id !== sender.id) throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only team leader can send invites');

    const { data: edition, error: editionError } = await supabase
      .from('editions')
      .select('team_management_locked')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (editionError) throw editionError;
    if (!edition) throw AppError.notFound('No active edition configured');
    if (edition.team_management_locked) throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');

    const { count: currentMemberCount, error: currentMembersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .is('deleted_at', null);

    if (currentMembersError) throw currentMembersError;
    if ((currentMemberCount ?? 0) >= TEAM_LIMITS.MAX_MEMBERS) {
      throw new AppError(ERROR_CODES.TEAM_FULL, 'Team already has the maximum number of members');
    }

    const { data: invitee, error: inviteeError } = await supabase
      .from('users')
      .select('*')
      .eq('id', inviteeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (inviteeError) throw inviteeError;
    if (!invitee) throw AppError.notFound('Invitee not found');
    if (invitee.team_id) throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'Invitee already belongs to a team');
    if (invitee.department !== team.department) {
      throw new AppError(ERROR_CODES.WRONG_DEPARTMENT, 'Invitee must be from the same department');
    }

    const { data: existingInvite, error: existingInviteError } = await supabase
      .from('team_invites')
      .select('id')
      .eq('team_id', team.id)
      .eq('invitee_id', inviteeId)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .maybeSingle();

    if (existingInviteError) throw existingInviteError;
    if (existingInvite) {
      throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'A pending invite already exists for this user');
    }

    const expiresAt = new Date(Date.now() + INVITE_LIMITS.EXPIRY_MS).toISOString();

    const { data: created, error } = await supabase
      .from('team_invites')
      .insert([
        {
          team_id: team.id,
          invitee_id: inviteeId,
          invited_by: sender.id,
          status: 'pending',
          expires_at: expiresAt,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert([
      {
        user_id: inviteeId,
        type: 'invite_received',
        title: 'Team invite received',
        message: `${sender.name} invited you to join ${team.name}`,
        action_url: '/dashboard/team',
      },
    ] as never[]);

    fireAndForget(
      getEmailService().sendTeamInvite(
        { to: invitee.email, name: invitee.name },
        {
          recipientName: invitee.name,
          teamName: team.name,
          inviterName: sender.name,
          expiresAt,
          invitesUrl: `${env.APP_URL}/dashboard/team`,
        },
      ),
      'team invite email',
    );

    res.status(201).json({
      status: 'success',
      data: { invite: created },
    });
  } catch (err) {
    next(err);
  }
};

export const respondInvite: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { inviteId, status } = req.body as { inviteId: string; status: 'accepted' | 'declined' };
    const supabase = getSupabaseService() as any;
    let result: { invite_id: string; invite_status: string } | null = null;
    const { data, error } = await supabase.rpc('respond_team_invite', {
      p_invite_id: inviteId,
      p_invitee_id: req.user.id,
      p_status: status,
    });

    if (!error) {
      result = Array.isArray(data) ? data[0] : data;
    } else {
      const message = error.message.toLowerCase();
      if (message.includes('expired')) {
        throw new AppError(ERROR_CODES.INVITE_EXPIRED, 'Invite has expired');
      }
      if (message.includes('team is full')) {
        throw new AppError(ERROR_CODES.TEAM_FULL, 'Team already has the maximum number of members');
      }
      if (message.includes('already belongs to a team')) {
        throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You already belong to a team');
      }
      if (message.includes('invite not found')) {
        throw AppError.notFound('Invite not found');
      }
      if (message.includes('no longer pending')) {
        throw AppError.validation('Invite is no longer pending');
      }
      if (error.code === '42702' || message.includes('ambiguous')) {
        result = await respondInviteWithFallback(inviteId, req.user.id, status);
      } else {
        throw error;
      }
    }

    if (!result) {
      throw AppError.internal('Invite response did not return a result');
    }

    res.status(200).json({
      status: 'success',
      data: { inviteId: result.invite_id, status: result.invite_status },
    });
  } catch (err) {
    next(err);
  }
};

export const acceptInvite: RequestHandler = async (req, res, next) => {
  req.body = {
    inviteId: (req.params as { id: string }).id,
    status: 'accepted',
  };
  return respondInvite(req, res, next);
};

export const declineInvite: RequestHandler = async (req, res, next) => {
  req.body = {
    inviteId: (req.params as { id: string }).id,
    status: 'declined',
  };
  return respondInvite(req, res, next);
};

export const removeMember: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const body = req.body as { userId?: string };
    const params = req.params as { userId?: string };
    const userId = body.userId ?? params.userId;
    if (!userId) throw AppError.validation('User id is required');
    if (userId === req.user.id) throw AppError.validation('Leader cannot remove self');

    const supabase = getSupabaseService() as any;
    const leader = await getUserProfile(req.user.id);
    if (!leader.team_id) throw AppError.validation('You are not in a team');

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', leader.team_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) throw AppError.notFound('Team not found');
    if (team.leader_id !== req.user.id) throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only leader can remove members');

    const { data: edition, error: editionError } = await supabase
      .from('editions')
      .select('team_management_locked')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (editionError) throw editionError;
    if (!edition) throw AppError.notFound('No active edition configured');
    if (edition.team_management_locked) throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');

    const { error: removeError } = await supabase
      .from('users')
      .update({ team_id: null } as never)
      .eq('id', userId)
      .eq('team_id', team.id);

    if (removeError) throw removeError;

    res.status(200).json({
      status: 'success',
    });
  } catch (err) {
    next(err);
  }
};

export const dissolveTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { teamId } = req.params as { teamId: string };
    const supabase = getSupabaseService() as any;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .is('deleted_at', null)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) throw AppError.notFound('Team not found');
    if (team.leader_id !== req.user.id) throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only leader can dissolve team');

    const { data: edition, error: editionError } = await supabase
      .from('editions')
      .select('team_management_locked')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (editionError) throw editionError;
    if (!edition) throw AppError.notFound('No active edition configured');
    if (edition.team_management_locked) throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');

    const now = new Date().toISOString();
    const members = await getTeamMembers(team.id);

    const [{ error: membersResetError }, { error: deleteError }] = await Promise.all([
      supabase
        .from('users')
        .update({ team_id: null } as never)
        .eq('team_id', team.id),
      supabase
        .from('teams')
        .update({ deleted_at: now } as never)
        .eq('id', team.id),
    ]);

    if (membersResetError) throw membersResetError;
    if (deleteError) throw deleteError;
    fireAndForget(
      Promise.allSettled(
        members.map((member) =>
          getEmailService().sendTeamDissolved(
            { to: member.email, name: member.name },
            {
              recipientName: member.name,
              teamName: team.name,
              dashboardUrl: `${env.APP_URL}/dashboard`,
            },
          ),
        ),
      ),
      'team dissolved emails',
    );

    res.status(200).json({
      status: 'success',
    });
  } catch (err) {
    next(err);
  }
};

export const dissolveMyTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const leader = await getUserProfile(req.user.id);
    if (!leader.team_id) throw AppError.validation('You are not in a team');

    req.params.teamId = leader.team_id;
    return dissolveTeam(req, res, next);
  } catch (err) {
    next(err);
  }
};
