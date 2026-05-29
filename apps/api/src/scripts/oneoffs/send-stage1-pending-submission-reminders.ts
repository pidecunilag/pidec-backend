import { platformReadService } from '../../application/shared/platform-read-service.js';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';

type TeamRow = {
  id: string;
  name: string;
  leader_id: string;
  status: 'active' | 'disqualified' | 'under_review' | string;
  edition_id: string;
  deleted_at: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  is_suspended: boolean;
  deleted_at: string | null;
};

const submissionsUrl = 'https://pidec.com.ng/dashboard/submissions';
const deadlineLabel = 'Sunday, May 31, 2026';
const deadlineDayUtc = Date.UTC(2026, 4, 31);
const dayMs = 24 * 60 * 60 * 1000;

const getLagosCalendarDayUtc = (date = new Date()): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return Date.UTC(year, month - 1, day);
};

const getDaysLeft = () =>
  Math.max(0, Math.ceil((deadlineDayUtc - getLagosCalendarDayUtc()) / dayMs));

const parseArgs = () => {
  const live = process.argv.includes('--live');
  const forceEdition = process.argv.includes('--force-edition');
  const limitRaw = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitRaw ? Number(limitRaw.split('=')[1]) : null;
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    // eslint-disable-next-line no-console
    console.error('Invalid --limit value');
    process.exit(1);
  }
  return { live, limit, forceEdition };
};

const uniq = <T,>(items: T[]): T[] => Array.from(new Set(items));

const formatRecipient = (name: string, email: string) => `${name} <${email}>`;

const main = async () => {
  const { live, limit, forceEdition } = parseArgs();
  const supabase = getSupabaseService();
  const daysLeft = getDaysLeft();

  const edition = await platformReadService.getActiveEdition();
  const editionName = (edition as unknown as { name?: string | null }).name ?? null;
  if (!forceEdition && editionName && !editionName.includes('1.0')) {
    // eslint-disable-next-line no-console
    console.error(
      `Refusing to send: active edition name does not look like PIDEC 1.0 (name=${JSON.stringify(editionName)}). ` +
        'Re-run with --force-edition to override.',
    );
    process.exit(1);
  }

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id,name,leader_id,status,edition_id,deleted_at')
    .eq('edition_id', edition.id)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (teamsError) throw teamsError;

  const activeTeams = (teams ?? []) as unknown as TeamRow[];
  const checkedTeams = activeTeams.length;

  const { data: stage1Submissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('team_id')
    .eq('edition_id', edition.id)
    .eq('stage', 1)
    .is('deleted_at', null);

  if (submissionsError) throw submissionsError;

  const submittedTeamIds = new Set<string>(
    (stage1Submissions ?? [])
      .map((row) => (row as unknown as { team_id: string | null }).team_id)
      .filter((id): id is string => Boolean(id)),
  );

  const skippedSubmittedTeams: Array<{ teamId: string; teamName: string }> = [];
  const pendingTeams: TeamRow[] = [];
  for (const team of activeTeams) {
    if (submittedTeamIds.has(team.id)) {
      skippedSubmittedTeams.push({ teamId: team.id, teamName: team.name });
      continue;
    }
    pendingTeams.push(team);
  }

  const leaderIds = uniq(pendingTeams.map((t) => t.leader_id).filter(Boolean));
  const leadersById = new Map<string, UserRow>();

  if (leaderIds.length > 0) {
    const { data: leaders, error: leadersError } = await supabase
      .from('users')
      .select('id,name,email,is_suspended,deleted_at')
      .in('id', leaderIds)
      .is('deleted_at', null);

    if (leadersError) throw leadersError;
    for (const leader of (leaders ?? []) as unknown as UserRow[]) {
      leadersById.set(leader.id, leader);
    }
  }

  const skippedLeaders: Array<{ teamId: string; teamName: string; reason: string }> = [];
  const candidates: Array<{ team: TeamRow; leader: UserRow }> = [];
  for (const team of pendingTeams) {
    const leader = leadersById.get(team.leader_id);
    if (!leader) {
      skippedLeaders.push({ teamId: team.id, teamName: team.name, reason: 'leader_not_found' });
      continue;
    }
    if (leader.is_suspended) {
      skippedLeaders.push({ teamId: team.id, teamName: team.name, reason: 'leader_suspended' });
      continue;
    }
    const email = leader.email?.trim();
    if (!email) {
      skippedLeaders.push({ teamId: team.id, teamName: team.name, reason: 'leader_missing_email' });
      continue;
    }
    candidates.push({ team, leader: { ...leader, email } });
  }

  const selected = limit ? candidates.slice(0, limit) : candidates;

  const sent: Array<{ teamId: string; teamName: string; to: string; id: string }> = [];
  const failed: Array<{ teamId: string; teamName: string; to: string; error: string }> = [];

  for (const { team, leader } of selected) {
    const to = formatRecipient(leader.name, leader.email ?? '');
    if (!live) {
      sent.push({ teamId: team.id, teamName: team.name, to, id: '(dry-run)' });
      continue;
    }

    try {
      const result = await getEmailService().sendStage1PendingSubmissionReminder(
        { to: leader.email ?? '', name: leader.name },
        { recipientName: leader.name, teamName: team.name, daysLeft, deadlineLabel },
      );
      if (!result.delivered || !result.id) {
        failed.push({
          teamId: team.id,
          teamName: team.name,
          to,
          error: 'resend_failed',
        });
        continue;
      }
      sent.push({ teamId: team.id, teamName: team.name, to, id: result.id });
    } catch (err) {
      failed.push({
        teamId: team.id,
        teamName: team.name,
        to,
        error: err instanceof Error ? err.message : 'unknown_error',
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: live ? 'live' : 'dry-run',
        edition: { id: edition.id, name: (edition as unknown as { name?: string }).name ?? null },
        submitUrl: submissionsUrl,
        deadline: { label: deadlineLabel, daysLeft },
        totals: {
          activeTeamsChecked: checkedTeams,
          skippedSubmittedTeams: skippedSubmittedTeams.length,
          skippedLeaders: skippedLeaders.length,
          candidates: candidates.length,
          attempted: selected.length,
          sent: sent.filter((s) => s.id !== '(dry-run)').length,
          dryRunWouldSend: live ? 0 : sent.length,
          failed: failed.length,
        },
        skippedSubmittedTeams,
        skippedLeaders,
        sentRecipients: sent,
        failedRecipients: failed,
      },
      null,
      2,
    ),
  );
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Stage 1 reminder run failed:', err);
  process.exitCode = 1;
});
