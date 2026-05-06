import { type RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/index.js';
import { teamApplicationService } from '../../application/team/team-application-service.js';

export const createTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();

    const { name } = req.body as { name: string };
    const team = await teamApplicationService.createTeam(req.user.id, name);

    logger.info({ userId: req.user.id, teamId: team.id }, 'Team created');
    res.status(201).json({ status: 'success', data: { team } });
  } catch (err) {
    next(err);
  }
};

export const getMyTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const result = await teamApplicationService.getMyTeam(req.user.id);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

export const searchTeammates: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { query } = req.query as { query: string };
    const results = await teamApplicationService.searchTeammates(req.user.id, query);
    res.status(200).json({ status: 'success', data: { results } });
  } catch (err) {
    next(err);
  }
};

export const listMyInvites: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const invites = await teamApplicationService.listMyInvites(req.user.id);
    res.status(200).json({ status: 'success', data: { invites } });
  } catch (err) {
    next(err);
  }
};

export const sendInvite: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { inviteeId } = req.body as { inviteeId: string };
    const invite = await teamApplicationService.sendInvite(req.user.id, inviteeId);
    res.status(201).json({ status: 'success', data: { invite } });
  } catch (err) {
    next(err);
  }
};

export const respondInvite: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { inviteId, status } = req.body as { inviteId: string; status: 'accepted' | 'declined' };
    const result = await teamApplicationService.respondInvite(req.user.id, inviteId, status);
    res.status(200).json({ status: 'success', data: { inviteId: result.invite_id, status: result.invite_status } });
  } catch (err) {
    next(err);
  }
};

export const acceptInvite: RequestHandler = async (req, res, next) => {
  req.body = { inviteId: (req.params as { id: string }).id, status: 'accepted' };
  return respondInvite(req, res, next);
};

export const declineInvite: RequestHandler = async (req, res, next) => {
  req.body = { inviteId: (req.params as { id: string }).id, status: 'declined' };
  return respondInvite(req, res, next);
};

export const removeMember: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const body = req.body as { userId?: string };
    const params = req.params as { userId?: string };
    const userId = body.userId ?? params.userId;
    if (!userId) throw AppError.validation('User id is required');

    await teamApplicationService.removeMember(req.user.id, userId);
    res.status(200).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

export const dissolveTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { teamId } = req.params as { teamId: string };
    await teamApplicationService.dissolveTeam(req.user.id, teamId);
    res.status(200).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

export const dissolveMyTeam: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const team = await teamApplicationService.getMyTeam(req.user.id);
    if (!team.team?.id) throw AppError.validation('You are not in a team');
    req.params.teamId = team.team.id;
    return dissolveTeam(req, res, next);
  } catch (err) {
    next(err);
  }
};
