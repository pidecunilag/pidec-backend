import { apiClient } from './api-client.js';
import type {
  AppNotification,
  Edition,
  Feedback,
  Judge,
  JudgeScore,
  Submission,
  Team,
  TeamInvite,
  User,
} from '@pidec/shared';

export interface TeamWithMembers {
  team: Team | null;
  members: Array<Pick<User, 'id' | 'name' | 'email' | 'role' | 'verificationStatus'>>;
}

export interface TeamSearchResult {
  id: string;
  name: string;
  email: string;
  department: string;
  verification_status: string;
}

export interface AdminOverview {
  edition: Edition;
  counts: {
    users: number;
    teams: number;
    submissions: number;
    activeJudges: number;
  };
}

export interface PaginatedNotifications {
  items: AppNotification[];
  nextCursor: string | null;
  hasMore: boolean;
}

const unwrap = <T>(
  response: { success: boolean; data?: T; error?: { message: string } },
  fallback: string,
): T => {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error?.message || fallback);
  }
  return response.data;
};

export class PlatformApiClient {
  // Teams
  async getMyTeam(): Promise<TeamWithMembers> {
    const response = await apiClient.get<TeamWithMembers>('/teams/me');
    return unwrap(response, 'Failed to fetch team');
  }

  async createTeam(name: string): Promise<{ team: Team }> {
    const response = await apiClient.post<{ team: Team }>('/teams', { name });
    return unwrap(response, 'Failed to create team');
  }

  async searchTeammates(query: string): Promise<{ results: TeamSearchResult[] }> {
    const response = await apiClient.get<{ results: TeamSearchResult[] }>(
      `/teams/search?query=${encodeURIComponent(query)}`,
    );
    return unwrap(response, 'Failed to search teammates');
  }

  async listInvites(): Promise<{ invites: TeamInvite[] }> {
    const response = await apiClient.get<{ invites: TeamInvite[] }>('/teams/invites');
    return unwrap(response, 'Failed to load invites');
  }

  async sendInvite(inviteeId: string): Promise<{ invite: TeamInvite }> {
    const response = await apiClient.post<{ invite: TeamInvite }>('/teams/invites', { inviteeId });
    return unwrap(response, 'Failed to send invite');
  }

  async respondInvite(
    inviteId: string,
    status: 'accepted' | 'declined',
  ): Promise<{ inviteId: string; status: string }> {
    const response = await apiClient.post<{ inviteId: string; status: string }>(
      '/teams/invites/respond',
      { inviteId, status },
    );
    return unwrap(response, 'Failed to respond to invite');
  }

  async removeMember(userId: string): Promise<void> {
    const response = await apiClient.post('/teams/members/remove', { userId });
    if (!response.success) throw new Error(response.error?.message || 'Failed to remove member');
  }

  async dissolveTeam(teamId: string): Promise<void> {
    const response = await apiClient.delete(`/teams/${teamId}`);
    if (!response.success) throw new Error(response.error?.message || 'Failed to dissolve team');
  }

  // Submissions
  async listMySubmissions(): Promise<{ submissions: Submission[] }> {
    const response = await apiClient.get<{ submissions: Submission[] }>('/submissions/me');
    return unwrap(response, 'Failed to load submissions');
  }

  async submitStage1(
    token: string,
    formData: Record<string, unknown>,
  ): Promise<{ submission: Submission; duplicated?: boolean }> {
    const response = await apiClient.post<{ submission: Submission; duplicated?: boolean }>(
      '/submissions/stage-1',
      {
        token,
        formData,
      },
    );
    return unwrap(response, 'Failed to submit Stage 1');
  }

  async submitStage2(
    videoLink: string,
    formData: Record<string, unknown>,
    fileIds: string[] = [],
  ): Promise<{ submission: Submission; duplicated?: boolean }> {
    const response = await apiClient.post<{ submission: Submission; duplicated?: boolean }>(
      '/submissions/stage-2',
      {
        videoLink,
        formData,
        fileIds,
      },
    );
    return unwrap(response, 'Failed to submit Stage 2');
  }

  async submitStage3(
    formData: Record<string, unknown>,
    fileIds: string[],
  ): Promise<{ submission: Submission; duplicated?: boolean }> {
    const response = await apiClient.post<{ submission: Submission; duplicated?: boolean }>(
      '/submissions/stage-3',
      {
        formData,
        fileIds,
      },
    );
    return unwrap(response, 'Failed to submit Stage 3');
  }

  // Notifications
  async listNotifications(cursor?: string, limit = 20): Promise<PaginatedNotifications> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    const response = await apiClient.get<PaginatedNotifications>(
      `/notifications?${params.toString()}`,
    );
    return unwrap(response, 'Failed to load notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    const response = await apiClient.post(`/notifications/${id}/read`);
    if (!response.success)
      throw new Error(response.error?.message || 'Failed to mark notification read');
  }

  async markAllNotificationsRead(): Promise<void> {
    const response = await apiClient.post('/notifications/read-all');
    if (!response.success)
      throw new Error(response.error?.message || 'Failed to mark notifications read');
  }

  // Feedback
  async listMyFeedback(): Promise<{ feedback: Feedback[] }> {
    const response = await apiClient.get<{ feedback: Feedback[] }>('/feedback/me');
    return unwrap(response, 'Failed to load feedback');
  }

  async getSubmissionFeedback(submissionId: string): Promise<{ feedback: Feedback | null }> {
    const response = await apiClient.get<{ feedback: Feedback | null }>(
      `/feedback/${submissionId}`,
    );
    return unwrap(response, 'Failed to load feedback');
  }

  // Judge
  async listJudgeSubmissions(stage = 1): Promise<{ submissions: Submission[] }> {
    const response = await apiClient.get<{ submissions: Submission[] }>(
      `/judge/submissions?stage=${stage}`,
    );
    return unwrap(response, 'Failed to load judge submissions');
  }

  async pickStage1Representative(
    submissionId: string,
    comments?: string,
  ): Promise<{ score: JudgeScore }> {
    const response = await apiClient.post<{ score: JudgeScore }>('/judge/stage-1/representative', {
      submissionId,
      ...(comments ? { comments } : {}),
    });
    return unwrap(response, 'Failed to save representative pick');
  }

  async submitStage2Score(
    submissionId: string,
    scores: Record<string, number>,
    comments: Record<string, string>,
  ): Promise<{ score: JudgeScore }> {
    const response = await apiClient.post<{ score: JudgeScore }>('/judge/stage-2/score', {
      submissionId,
      scores,
      comments,
    });
    return unwrap(response, 'Failed to save Stage 2 score');
  }

  // Admin
  async getOverview(): Promise<AdminOverview> {
    const response = await apiClient.get<AdminOverview>('/admin/overview');
    return unwrap(response, 'Failed to load admin overview');
  }

  async updateEdition(
    payload: Partial<Pick<Edition, 'name' | 'theme' | 'announcementBanner'>>,
  ): Promise<{ edition: Edition }> {
    const response = await apiClient.patch<{ edition: Edition }>('/admin/edition', payload);
    return unwrap(response, 'Failed to update edition');
  }

  async setActiveStage(stage: 0 | 1 | 2 | 3): Promise<{ edition: Edition }> {
    const response = await apiClient.post<{ edition: Edition }>('/admin/stage', { stage });
    return unwrap(response, 'Failed to update active stage');
  }

  async toggleSignup(open: boolean): Promise<{ edition: Edition }> {
    const response = await apiClient.post<{ edition: Edition }>('/admin/signup', { open });
    return unwrap(response, 'Failed to toggle signup');
  }

  async toggleSubmissionWindow(open: boolean): Promise<{ edition: Edition }> {
    const response = await apiClient.post<{ edition: Edition }>('/admin/submission-window', {
      open,
    });
    return unwrap(response, 'Failed to toggle submission window');
  }

  async toggleTeamLock(open: boolean): Promise<{ edition: Edition }> {
    const response = await apiClient.post<{ edition: Edition }>('/admin/team-lock', { open });
    return unwrap(response, 'Failed to toggle team lock');
  }

  async verifyUser(
    userId: string,
    decision: 'approve' | 'reject' | 'request_resubmission',
    payload: { reason?: string; note?: string } = {},
  ): Promise<{ user: User }> {
    const response = await apiClient.post<{ user: User }>(`/admin/users/${userId}/verification`, {
      decision,
      ...payload,
    });
    return unwrap(response, 'Failed to update verification status');
  }

  async suspendUser(userId: string, reason: string): Promise<{ user: User }> {
    const response = await apiClient.post<{ user: User }>(`/admin/users/${userId}/suspend`, {
      reason,
    });
    return unwrap(response, 'Failed to suspend user');
  }

  async unsuspendUser(userId: string): Promise<{ user: User }> {
    const response = await apiClient.post<{ user: User }>(`/admin/users/${userId}/unsuspend`);
    return unwrap(response, 'Failed to unsuspend user');
  }

  async applyTeamAction(
    teamId: string,
    action: 'advance' | 'disqualify' | 'unlock_submission',
    payload: { reason?: string; atStage?: 1 | 2 | 3 } = {},
  ): Promise<{ team: Team }> {
    const response = await apiClient.post<{ team: Team }>(`/admin/teams/${teamId}/action`, {
      action,
      ...payload,
    });
    return unwrap(response, 'Failed to apply team action');
  }

  async generateDepartmentToken(
    department: string,
    expiresAt?: string,
  ): Promise<{ token: unknown }> {
    const response = await apiClient.post<{ token: unknown }>('/admin/tokens/generate', {
      department,
      ...(expiresAt ? { expiresAt } : {}),
    });
    return unwrap(response, 'Failed to generate token');
  }

  async createJudge(payload: {
    name: string;
    email: string;
    stageScope: 'stage_1' | 'stage_2';
    assignedDepartments: string[];
  }): Promise<{ judge: Judge }> {
    const response = await apiClient.post<{ judge: Judge }>('/admin/judges', payload);
    return unwrap(response, 'Failed to create judge');
  }

  async deactivateJudge(judgeId: string): Promise<{ judge: Judge }> {
    const response = await apiClient.post<{ judge: Judge }>(`/admin/judges/${judgeId}/deactivate`);
    return unwrap(response, 'Failed to deactivate judge');
  }

  async enterFeedback(
    submissionId: string,
    payload: {
      scores: Record<string, number>;
      comments: Record<string, string>;
      totalScore: number;
      outcome: 'advanced' | 'not_advanced' | 'pending';
      evaluatorName: string;
      evaluationDate?: string;
    },
  ): Promise<{ feedback: Feedback }> {
    const response = await apiClient.post<{ feedback: Feedback }>(
      `/admin/feedback/${submissionId}`,
      payload,
    );
    return unwrap(response, 'Failed to enter feedback');
  }

  async publishFeedback(submissionIds: string[]): Promise<{ feedback: Feedback[] }> {
    const response = await apiClient.post<{ feedback: Feedback[] }>('/admin/feedback/publish', {
      submissionIds,
    });
    return unwrap(response, 'Failed to publish feedback');
  }
}

export const platformClient = new PlatformApiClient();
