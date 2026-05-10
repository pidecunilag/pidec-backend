import { ERROR_CODES, INVITE_LIMITS, TEAM_LIMITS } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';
import {
  platformReadService,
  type TeamInviteRow,
  type TeamMemberSummary,
  type TeamRow,
  type UserRow,
} from '../shared/platform-read-service.js';

type TeamDetails = {
  team: TeamRow | null;
  members: Array<
    Pick<UserRow, 'id' | 'name' | 'email' | 'matric_number' | 'department' | 'level' | 'verification_status'> & {
      role: 'leader' | 'member';
    }
  >;
};

type InviteWithRelations = TeamInviteRow & {
  teams: { id: string; name: string; department: string } | null;
  users: { id: string; name: string; email: string } | null;
};

const supabase = getSupabaseService();

const queueTeamDissolvedEmails = (members: TeamMemberSummary[], teamName: string) => {
  fireAndForget(
    Promise.allSettled(
      members.map((member) =>
        getEmailService().sendTeamDissolved(
          { to: member.email, name: member.name },
          {
            recipientName: member.name,
            teamName,
            dashboardUrl: `${env.APP_URL}/dashboard`,
          },
        ),
      ),
    ),
    'team dissolved emails',
  );
};

const mapRpcInviteError = (error: { code?: string; message?: string }): never => {
  const message = String(error.message ?? '').toLowerCase();
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

  throw error;
};

export class TeamApplicationService {
  async createTeam(userId: string, name: string): Promise<TeamRow> {
    const user = await platformReadService.getUserById(userId);

    if (user.is_suspended) throw AppError.forbidden('Suspended users cannot create teams');
    if (user.verification_status !== 'verified') {
      throw new AppError(ERROR_CODES.VERIFICATION_PENDING, 'Only verified users can create teams');
    }
    if (user.team_id) throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You are already in a team');

    const edition = await platformReadService.getActiveEdition();
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
    const createdTeam = team as TeamRow;

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ team_id: createdTeam.id } as never)
      .eq('id', user.id);

    if (userUpdateError) throw userUpdateError;
    return createdTeam;
  }

  async getMyTeam(userId: string): Promise<TeamDetails> {
    const user = await platformReadService.getUserById(userId);
    if (!user.team_id) {
      return { team: null, members: [] };
    }

    const [{ data: team, error: teamError }, { data: members, error: membersError }] =
      await Promise.all([
        supabase.from('teams').select('*').eq('id', user.team_id).is('deleted_at', null).maybeSingle(),
        supabase
          .from('users')
          .select('id,name,email,matric_number,department,level,verification_status')
          .eq('team_id', user.team_id)
          .is('deleted_at', null),
      ]);

    if (teamError) throw teamError;
    if (membersError) throw membersError;

    const teamRow = team as TeamRow | null;
    const memberRows = (members ?? []) as TeamDetails['members'];

    return {
      team: teamRow,
      members: memberRows.map((member) => ({
        ...member,
        role: teamRow?.leader_id === member.id ? 'leader' : 'member',
      })),
    };
  }

  async searchTeammates(userId: string, query: string) {
    const user = await platformReadService.getUserById(userId);

    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,matric_number,department,level,verification_status')
      .ilike('name', `%${query}%`)
      .eq('department', user.department)
      .is('team_id', null)
      .eq('verification_status', 'verified')
      .is('deleted_at', null)
      .neq('id', user.id)
      .limit(20);

    if (error) throw error;
    const students = (data ?? []) as Array<
      Pick<UserRow, 'id' | 'name' | 'email' | 'matric_number' | 'department' | 'level' | 'verification_status'>
    >;

    return students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      matricNumber: student.matric_number,
      department: student.department,
      level: student.level,
      verificationStatus: student.verification_status,
    }));
  }

  async listMyInvites(userId: string): Promise<InviteWithRelations[]> {
    const now = new Date().toISOString();
    const { error: expireError } = await supabase
      .from('team_invites')
      .update({ status: 'expired', responded_at: now } as never)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (expireError) throw expireError;

    const { data, error } = await supabase
      .from('team_invites')
      .select('*, teams(id,name,department), users!team_invites_invited_by_fkey(id,name,email)')
      .eq('invitee_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as InviteWithRelations[];
  }

  async sendInvite(senderId: string, inviteeId: string): Promise<TeamInviteRow> {
    const sender = await platformReadService.getUserById(senderId);
    if (!sender.team_id) throw AppError.validation('You must belong to a team to invite members');

    const team = await platformReadService.getTeamById(sender.team_id);
    if (team.leader_id !== sender.id) {
      throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only team leader can send invites');
    }

    const edition = await platformReadService.getActiveEdition();
    if (edition.team_management_locked) {
      throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');
    }

    const currentMemberCount = await platformReadService.countTeamMembers(team.id);
    if (currentMemberCount >= TEAM_LIMITS.MAX_MEMBERS) {
      throw new AppError(ERROR_CODES.TEAM_FULL, 'Team already has the maximum number of members');
    }

    const { data: invitee, error: inviteeError } = await supabase
      .from('users')
      .select('*')
      .eq('id', inviteeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (inviteeError) throw inviteeError;
    const inviteeRow = invitee as UserRow | null;
    if (!inviteeRow) throw AppError.notFound('Invitee not found');
    if (inviteeRow.team_id) throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'Invitee already belongs to a team');
    if (inviteeRow.department !== team.department) {
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
        { to: inviteeRow.email, name: inviteeRow.name },
        {
          recipientName: inviteeRow.name,
          teamName: team.name,
          inviterName: sender.name,
          expiresAt,
          invitesUrl: `${env.APP_URL}/dashboard/team`,
        },
      ),
      'team invite email',
    );

    return created;
  }

  async respondInvite(inviteeId: string, inviteId: string, status: 'accepted' | 'declined') {
    const { data, error } = await supabase.rpc('respond_team_invite' as never, {
      p_invite_id: inviteId,
      p_invitee_id: inviteeId,
      p_status: status,
    } as never);

    if (!error) {
      const result = (Array.isArray(data) ? data[0] : data) as
        | { invite_id: string; invite_status: string }
        | null;
      if (!result) throw AppError.internal('Invite response did not return a result');
      return result;
    }

    const message = String(error.message ?? '').toLowerCase();
    if (error.code !== '42702' && !message.includes('ambiguous')) {
      mapRpcInviteError(error);
    }

    return this.respondInviteWithFallback(inviteId, inviteeId, status);
  }

  private async respondInviteWithFallback(
    inviteId: string,
    inviteeId: string,
    status: 'accepted' | 'declined',
  ): Promise<{ invite_id: string; invite_status: string }> {
    const invite = await platformReadService.findInviteById(inviteId, inviteeId);
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
      const [{ data: invitee, error: inviteeError }, { data: team, error: teamError }] =
        await Promise.all([
          supabase.from('users').select('*').eq('id', inviteeId).is('deleted_at', null).maybeSingle(),
          supabase.from('teams').select('*').eq('id', invite.team_id).is('deleted_at', null).maybeSingle(),
        ]);

      if (inviteeError) throw inviteeError;
      if (teamError) throw teamError;
      const inviteeRow = invitee as UserRow | null;
      const teamRow = team as TeamRow | null;
      if (!inviteeRow) throw AppError.notFound('Invitee not found');
      if (!teamRow) throw AppError.notFound('Team not found');
      if (inviteeRow.team_id) {
        throw new AppError(ERROR_CODES.ALREADY_IN_TEAM, 'You already belong to a team');
      }

      const teamMemberCount = await platformReadService.countTeamMembers(invite.team_id);
      if (teamMemberCount >= TEAM_LIMITS.MAX_MEMBERS) {
        throw new AppError(ERROR_CODES.TEAM_FULL, 'Team already has the maximum number of members');
      }

      const { data: membershipUpdate, error: membershipError } = await supabase
        .from('users')
        .update({ team_id: teamRow.id, updated_at: now } as never)
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
    const updatedInviteRow = updatedInvite as { id: string; status: string } | null;
    if (!updatedInviteRow) {
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
      invite_id: updatedInviteRow.id,
      invite_status: updatedInviteRow.status,
    };
  }

  async removeMember(leaderId: string, userId: string): Promise<void> {
    if (userId === leaderId) throw AppError.validation('Leader cannot remove self');

    const leader = await platformReadService.getUserById(leaderId);
    if (!leader.team_id) throw AppError.validation('You are not in a team');

    const team = await platformReadService.getTeamById(leader.team_id);
    if (team.leader_id !== leaderId) {
      throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only leader can remove members');
    }

    const edition = await platformReadService.getActiveEdition();
    if (edition.team_management_locked) {
      throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');
    }

    const { error: removeError } = await supabase
      .from('users')
      .update({ team_id: null } as never)
      .eq('id', userId)
      .eq('team_id', team.id);

    if (removeError) throw removeError;
  }

  async dissolveTeam(leaderId: string, teamId: string): Promise<void> {
    const team = await platformReadService.getTeamById(teamId);
    if (team.leader_id !== leaderId) {
      throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only leader can dissolve team');
    }

    const edition = await platformReadService.getActiveEdition();
    if (edition.team_management_locked) {
      throw new AppError(ERROR_CODES.TEAM_LOCKED, 'Team management is locked');
    }

    const now = new Date().toISOString();
    const members = await platformReadService.listTeamMembers(team.id);

    const [{ error: membersResetError }, { error: deleteError }] = await Promise.all([
      supabase.from('users').update({ team_id: null } as never).eq('team_id', team.id),
      supabase.from('teams').update({ deleted_at: now } as never).eq('id', team.id),
    ]);

    if (membersResetError) throw membersResetError;
    if (deleteError) throw deleteError;

    queueTeamDissolvedEmails(members, team.name);
  }
}

export const teamApplicationService = new TeamApplicationService();
