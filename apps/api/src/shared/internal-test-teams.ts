import { env } from './config/env.js';

const DEFAULT_INTERNAL_TEST_TEAM_IDS = ['8a648a2c-cead-4e7f-a1c5-951a99132bb7'];

const parseIdList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

export const internalTestTeamIds = Array.from(
  new Set([
    ...DEFAULT_INTERNAL_TEST_TEAM_IDS,
    ...parseIdList(env.JUDGE_EXCLUDED_TEAM_IDS),
    ...parseIdList(env.INTERNAL_TEST_TEAM_IDS),
  ]),
);

export const isInternalTestTeamId = (teamId?: string | null) =>
  Boolean(teamId && internalTestTeamIds.includes(teamId));

type SupabaseNotQuery<TQuery> = {
  not: (column: string, operator: string, value: string) => TQuery;
};

type SupabaseOrQuery<TQuery> = {
  or: (filters: string) => TQuery;
};

export const excludeInternalTestTeams = <TQuery extends SupabaseNotQuery<TQuery>>(
  query: TQuery,
  column = 'id',
) =>
  internalTestTeamIds.length > 0
    ? query.not(column, 'in', `(${internalTestTeamIds.join(',')})`)
    : query;

export const excludeInternalTestTeamUsers = <TQuery extends SupabaseOrQuery<TQuery>>(
  query: TQuery,
) =>
  internalTestTeamIds.length > 0
    ? query.or(`team_id.is.null,team_id.not.in.(${internalTestTeamIds.join(',')})`)
    : query;
