import type { Database } from '@pidec/db-types';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { AppError } from '../../shared/errors/app-error.js';

export type EditionRow = Database['public']['Tables']['editions']['Row'];
export type UserRow = Database['public']['Tables']['users']['Row'];
export type TeamRow = Database['public']['Tables']['teams']['Row'];
export type SubmissionRow = Database['public']['Tables']['submissions']['Row'];
export type JudgeRow = Database['public']['Tables']['judges']['Row'];
export type FeedbackRow = Database['public']['Tables']['feedback']['Row'];
export type JudgeScoreRow = Database['public']['Tables']['judge_scores']['Row'];
export type TokenRow = Database['public']['Tables']['tokens']['Row'];
export type TeamInviteRow = Database['public']['Tables']['team_invites']['Row'];

export type TeamMemberSummary = Pick<UserRow, 'id' | 'name' | 'email'>;

export class PlatformReadService {
  private readonly supabase = getSupabaseService();

  async getActiveEdition(): Promise<EditionRow> {
    const { data, error } = await this.supabase
      .from('editions')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw AppError.notFound('No active edition configured');
    return data;
  }

  async getUserById(userId: string): Promise<UserRow> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw AppError.notFound('User profile not found');
    return data;
  }

  async getTeamById(teamId: string): Promise<TeamRow> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw AppError.notFound('Team not found');
    return data;
  }

  async getJudgeById(judgeId: string): Promise<JudgeRow> {
    const { data, error } = await this.supabase
      .from('judges')
      .select('*')
      .eq('id', judgeId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw AppError.forbidden('Judge profile is not active');
    return data;
  }

  async listTeamMembers(teamId: string): Promise<TeamMemberSummary[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id,name,email')
      .eq('team_id', teamId)
      .is('deleted_at', null);

    if (error) throw error;
    return data ?? [];
  }

  async countTeamMembers(teamId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    if (error) throw error;
    return count ?? 0;
  }

  async findInviteById(inviteId: string, inviteeId?: string): Promise<TeamInviteRow | null> {
    let query = this.supabase
      .from('team_invites')
      .select('*')
      .eq('id', inviteId)
      .is('deleted_at', null);

    if (inviteeId) query = query.eq('invitee_id', inviteeId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ?? null;
  }
}

export const platformReadService = new PlatformReadService();
