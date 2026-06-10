import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL ?? 'https://pidec.com.ng';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'PIDEC 1.0 <competitions@pidec.com.ng>';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const logoUrl = `${APP_URL.replace(/\/$/, '')}/logos/Coloured%20Logo%20Black%20text%20Trans.png`;
const feedbackUrl = `${APP_URL.replace(/\/$/, '')}/dashboard/feedback`;
const stage2WhatsappUrl = 'https://chat.whatsapp.com/CuG3ogIQHtTDRSEwsFwlaC?mode=gi_t';

const topTeams = [
  { rank: 1, department: 'Biomedical Engineering', team: 'HemoSense' },
  { rank: 2, department: 'Chemical Engineering', team: 'TEAM CHG' },
  { rank: 3, department: 'Civil and Environmental Engineering', team: 'CivEngage' },
  { rank: 4, department: 'Computer Engineering', team: 'Team typedev' },
  { rank: 5, department: 'Electrical and Electronics Engineering', team: 'Team Alpha' },
  { rank: 6, department: 'Mechanical Engineering', team: 'EXO-MEG' },
  { rank: 7, department: 'Metallurgical and Materials Engineering', team: 'Team Nexus' },
  { rank: 8, department: 'Petroleum and Gas Engineering', team: 'DrillPrime' },
  { rank: 9, department: 'Surveying and Geoinformatics Engineering', team: 'The Pionieers' },
  { rank: 10, department: 'Systems Engineering', team: 'Excel' },
] as const;

type Recipient = {
  id: string;
  name: string;
  email: string;
  team_id?: string | null;
};

type TeamRecord = {
  id: string;
  name: string;
  department: string;
  leader_id: string;
  current_stage: number;
  status: string;
};

type SubmissionRecord = {
  id: string;
  team_id: string;
  stage: number;
  status: string;
  teams: TeamRecord | null;
};

type JudgeScoreRecord = {
  submission_id: string;
  scores: Record<string, number> | null;
  comments: Record<string, string> | null;
  total_score: number | null;
  judges?: { name?: string | null; email?: string | null } | null;
};

const parseArgs = () => {
  const live = process.argv.includes('--live');
  const toArg = process.argv.find((arg) => arg.startsWith('--to='));
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const to = toArg ? (toArg.split('=')[1]?.trim().toLowerCase() || null) : null;
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error('Invalid --limit value');
  }
  return { live, to, limit };
};

type LaunchStage1ResultsOptions = {
  live: boolean;
  to?: string | null;
  limit?: number | null;
};

const parseEmailAddress = (raw: string) => {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (!match) return { email: trimmed };
  const name = match[1]?.trim();
  return { email: match[2]?.trim() ?? trimmed, ...(name ? { name } : {}) };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isObviousTestEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  return (
    !normalized ||
    normalized.endsWith('@example.com') ||
    normalized.includes('test@') ||
    normalized.includes('+test') ||
    normalized.includes('dummy') ||
    normalized.includes('fake') ||
    normalized.includes('sample')
  );
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const formatTopTeamsText = () =>
  topTeams.map((item) => `${item.rank}. ${item.team} (${item.department})`).join('\n');

const renderShell = ({
  preview,
  body,
}: {
  preview: string;
  body: string;
}) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;background:#f7f1fb;font-family:Arial,Helvetica,sans-serif;color:#2a003b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #eadff1;">
            <tr>
              <td style="padding:30px 34px 8px;">
                <img src="${logoUrl}" width="176" alt="PIDEC 1.0" style="display:block;width:176px;max-width:70%;height:auto;border:0;" />
              </td>
            </tr>
            ${body}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const renderGeneralEmail = (recipientName: string) => {
  const rows = topTeams
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #eee5f4;color:#2a003b;font-weight:700;width:38px;">${item.rank}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eee5f4;color:#2a003b;font-weight:700;">${escapeHtml(item.team)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eee5f4;color:#6d4b7a;">${escapeHtml(item.department)}</td>
        </tr>`,
    )
    .join('');

  const html = renderShell({
    preview: 'Congratulations to the Top 10 teams advancing to Stage 2.',
    body: `
      <tr>
        <td style="padding:16px 34px 18px;">
          <h1 style="margin:0;font-size:30px;line-height:1.25;color:#2a003b;">Stage 1 results are out</h1>
          <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Hi ${escapeHtml(getFirstName(recipientName))},</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Thank you for being part of PIDEC 1.0.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Stage 1 has officially been reviewed, and we are excited to announce the Top 10 teams advancing to Stage 2 of the Prototype Inter-Departmental Engineering Challenge.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 34px 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fbf8fd;border:1px solid #eadff1;border-radius:16px;overflow:hidden;">
            <tr>
              <th align="left" style="padding:12px 10px;background:#2a003b;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:1.6px;width:38px;">#</th>
              <th align="left" style="padding:12px 10px;background:#2a003b;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:1.6px;">Team</th>
              <th align="left" style="padding:12px 10px;background:#2a003b;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:1.6px;">Department</th>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 34px 34px;">
          <p style="margin:0;font-size:16px;line-height:1.7;color:#5f3c6d;">To every team that submitted but did not make it to the next stage, thank you. Your ideas, effort, and participation helped make Stage 1 meaningful, competitive, and inspiring. The fact that you formed teams, developed proposals, and put your work forward is something we deeply appreciate.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">To everyone who registered, joined a team, attended sessions, asked questions, or followed the process, thank you for helping shape the first edition of PIDEC.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">The advancing teams will receive further instructions about Stage 2 soon. Please keep an eye on your email and our official communication channels for the next update.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Congratulations once again to the Top 10 teams, and thank you all for being part of PIDEC 1.0.</p>
          <p style="margin:24px 0 0;font-size:16px;line-height:1.7;color:#2a003b;font-weight:700;">Faisal Adams,<br />Chairperson, PIDEC 1.0</p>
        </td>
      </tr>`,
  });

  const text = `Hi ${getFirstName(recipientName)},

Thank you for being part of PIDEC 1.0.

Stage 1 has officially been reviewed, and we are excited to announce the Top 10 teams advancing to Stage 2 of the Prototype Inter-Departmental Engineering Challenge.

${formatTopTeamsText()}

To every team that submitted but did not make it to the next stage, thank you. Your ideas, effort, and participation helped make Stage 1 meaningful, competitive, and inspiring. The fact that you formed teams, developed proposals, and put your work forward is something we deeply appreciate.

To everyone who registered, joined a team, attended sessions, asked questions, or followed the process, thank you for helping shape the first edition of PIDEC.

The advancing teams will receive further instructions about Stage 2 soon. Please keep an eye on your email and our official communication channels for the next update.

Congratulations once again to the Top 10 teams, and thank you all for being part of PIDEC 1.0.

Faisal Adams,
Chairperson, PIDEC 1.0`;

  return {
    subject: 'PIDEC 1.0 Stage 1 Results Are Out',
    html,
    text,
  };
};

const renderLeadEmail = (recipientName: string, teamName: string) => {
  const html = renderShell({
    preview: 'Your team has been selected as one of the PIDEC 1.0 Stage 1 top teams.',
    body: `
      <tr>
        <td style="padding:16px 34px 34px;">
          <h1 style="margin:0;font-size:30px;line-height:1.25;color:#2a003b;">Congratulations, your team is advancing to Stage 2</h1>
          <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Hi ${escapeHtml(getFirstName(recipientName))},</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Congratulations to you and your team.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Your team, <strong style="color:#2a003b;">${escapeHtml(teamName)}</strong>, has been selected as one of the Top 10 teams advancing to Stage 2 of PIDEC 1.0.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">This selection follows the review of Stage 1 submissions across participating departments. Your proposal stood out within your department, and we are excited to see how your team develops the idea further in the next stage.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Your Stage 1 review has been published on your dashboard. Please sign in to view the feedback and scores from the review process.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
            <tr>
              <td style="border-radius:999px;background:#2a003b;">
                <a href="${feedbackUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">View published review</a>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">We have also created a WhatsApp group for teams advancing to Stage 2. Please join the group and share the link with your team members so everyone receives the next-stage updates quickly.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
            <tr>
              <td style="border-radius:999px;background:#8b3dff;">
                <a href="${stage2WhatsappUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">Join Stage 2 WhatsApp group</a>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">We will share further details soon on the next steps for Stage 2, including timelines, expectations, and what your team needs to prepare.</p>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#5f3c6d;">Congratulations once again to you and your team. Thank you for the work you have put into PIDEC 1.0 so far.</p>
          <p style="margin:24px 0 0;font-size:16px;line-height:1.7;color:#2a003b;font-weight:700;">Faisal Adams,<br />Chairperson, PIDEC 1.0</p>
        </td>
      </tr>`,
  });

  const text = `Hi ${getFirstName(recipientName)},

Congratulations to you and your team.

Your team, ${teamName}, has been selected as one of the Top 10 teams advancing to Stage 2 of PIDEC 1.0.

This selection follows the review of Stage 1 submissions across participating departments. Your proposal stood out within your department, and we are excited to see how your team develops the idea further in the next stage.

Your Stage 1 review has been published on your dashboard. Please sign in to view the feedback and scores from the review process:
${feedbackUrl}

We have also created a WhatsApp group for teams advancing to Stage 2. Please join the group and share the link with your team members so everyone receives the next-stage updates quickly:
${stage2WhatsappUrl}

We will share further details soon on the next steps for Stage 2, including timelines, expectations, and what your team needs to prepare.

Congratulations once again to you and your team. Thank you for the work you have put into PIDEC 1.0 so far.

Faisal Adams,
Chairperson, PIDEC 1.0`;

  return {
    subject: 'Congratulations, your team is advancing to Stage 2',
    html,
    text,
  };
};

const sendBrevo = async ({
  to,
  subject,
  html,
  text,
  tags,
}: {
  to: Recipient;
  subject: string;
  html: string;
  text: string;
  tags: string[];
}) => {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: parseEmailAddress(FROM_EMAIL),
      to: [{ email: to.email, name: to.name }],
      subject,
      htmlContent: html,
      textContent: text,
      tags,
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo ${response.status}: ${rawBody}`);
  }

  return rawBody;
};

const averageScoreMaps = (scores: JudgeScoreRecord[]) => {
  const keys = Array.from(
    new Set(scores.flatMap((score) => Object.keys(score.scores ?? {}))),
  );
  return Object.fromEntries(
    keys.map((key) => {
      const values = scores
        .map((score) => score.scores?.[key])
        .filter((value): value is number => typeof value === 'number');
      const average = values.length
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : 0;
      return [key, average];
    }),
  );
};

const mergeJudgeComments = (scores: JudgeScoreRecord[]) => {
  if (scores.length === 1) return scores[0]?.comments ?? {};

  const merged: Record<string, string> = {};
  scores.forEach((score, index) => {
    const judgeLabel = score.judges?.name ?? score.judges?.email ?? `Judge ${index + 1}`;
    for (const [key, value] of Object.entries(score.comments ?? {})) {
      if (!value?.trim()) continue;
      merged[`${judgeLabel} - ${key}`] = value;
    }
  });
  return merged;
};

export const launchStage1Results = async ({ live, to = null, limit = null }: LaunchStage1ResultsOptions) => {
  const shouldMutatePlatform = live && !to;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase service env is not set');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: edition, error: editionError } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (editionError) throw editionError;
  if (!edition) throw new Error('No active edition found');

  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('id,email')
    .eq('role', 'admin')
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (adminError) throw adminError;

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id,name,email,team_id')
    .eq('role', 'student')
    .is('deleted_at', null)
    .not('email', 'is', null);
  if (usersError) throw usersError;

  const recipientsByEmail = new Map<string, Recipient>();
  const skippedRecipients: Array<{ email: string; reason: string }> = [];
  for (const user of (users ?? []) as Recipient[]) {
    const email = String(user.email ?? '').trim().toLowerCase();
    if (isObviousTestEmail(email)) {
      skippedRecipients.push({ email, reason: 'obvious_test_or_invalid' });
      continue;
    }
    if (!recipientsByEmail.has(email)) {
      recipientsByEmail.set(email, { ...user, email });
    }
  }

  let generalRecipients = [...recipientsByEmail.values()];
  if (to) generalRecipients = generalRecipients.filter((recipient) => recipient.email.toLowerCase() === to);
  if (limit) generalRecipients = generalRecipients.slice(0, limit);

  const { data: topSubmissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('id,team_id,stage,status,teams!inner(id,name,department,leader_id,current_stage,status)')
    .eq('edition_id', edition.id)
    .eq('stage', 1)
    .is('deleted_at', null)
    .in('teams.name', topTeams.map((item) => item.team));
  if (submissionsError) throw submissionsError;

  const topByKey = new Map<string, SubmissionRecord>();
  for (const submission of (topSubmissions ?? []) as unknown as SubmissionRecord[]) {
    const team = submission.teams;
    if (!team) continue;
    topByKey.set(`${team.name}::${team.department}`, submission);
  }

  const missingTopTeams = topTeams.filter((item) => !topByKey.has(`${item.team}::${item.department}`));
  if (missingTopTeams.length > 0) {
    throw new Error(`Could not resolve top teams: ${missingTopTeams.map((item) => `${item.team} (${item.department})`).join(', ')}`);
  }

  const resolvedTopSubmissions = topTeams.map((item) => topByKey.get(`${item.team}::${item.department}`)!);
  const topSubmissionIds = resolvedTopSubmissions.map((submission) => submission.id);
  const topTeamIds = resolvedTopSubmissions.map((submission) => submission.team_id);
  const leaderIds = resolvedTopSubmissions.map((submission) => submission.teams?.leader_id).filter(Boolean);

  const { data: leaders, error: leadersError } = await supabase
    .from('users')
    .select('id,name,email,team_id')
    .in('id', leaderIds)
    .is('deleted_at', null);
  if (leadersError) throw leadersError;

  const leadersById = new Map((leaders ?? []).map((leader) => [leader.id, leader as Recipient]));
  let leadRecipients = resolvedTopSubmissions
    .map((submission) => {
      const leader = leadersById.get(submission.teams?.leader_id ?? '');
      if (!leader?.email || isObviousTestEmail(leader.email)) return null;
      return {
        recipient: { ...leader, email: leader.email.toLowerCase() },
        teamName: submission.teams?.name ?? 'your team',
      };
    })
    .filter((item): item is { recipient: Recipient; teamName: string } => Boolean(item));
  if (to) leadRecipients = leadRecipients.filter((item) => item.recipient.email.toLowerCase() === to);
  if (limit) leadRecipients = leadRecipients.slice(0, limit);

  const { data: judgeScores, error: judgeScoresError } = await supabase
    .from('judge_scores')
    .select('submission_id,scores,comments,total_score,judges(name,email)')
    .in('submission_id', topSubmissionIds)
    .is('deleted_at', null);
  if (judgeScoresError) throw judgeScoresError;

  const scoresBySubmission = new Map<string, JudgeScoreRecord[]>();
  for (const score of (judgeScores ?? []) as unknown as JudgeScoreRecord[]) {
    scoresBySubmission.set(score.submission_id, [
      ...(scoresBySubmission.get(score.submission_id) ?? []),
      score,
    ]);
  }

  const missingScores = topSubmissionIds.filter((submissionId) => (scoresBySubmission.get(submissionId) ?? []).length === 0);
  if (missingScores.length > 0) {
    throw new Error(`Cannot publish reviews: missing judge scores for ${missingScores.join(', ')}`);
  }

  const now = new Date().toISOString();
  const feedbackPayload = resolvedTopSubmissions.map((submission) => {
    const scores = scoresBySubmission.get(submission.id) ?? [];
    const totalValues = scores
      .map((score) => score.total_score)
      .filter((value): value is number => typeof value === 'number');
    const totalScore = totalValues.length
      ? Number((totalValues.reduce((sum, value) => sum + value, 0) / totalValues.length).toFixed(2))
      : null;
    const firstScore = scores[0];

    return {
      submission_id: submission.id,
      scores: averageScoreMaps(scores),
      comments: mergeJudgeComments(scores),
      total_score: totalScore,
      outcome: 'advanced',
      entered_by_admin: admin.id,
      evaluator_name: scores.length === 1 && firstScore
        ? firstScore.judges?.name ?? firstScore.judges?.email ?? 'PIDEC Judge'
        : 'PIDEC Judges',
      evaluation_date: now.slice(0, 10),
      published: true,
      published_at: now,
      published_by: admin.id,
    };
  });

  const generalSent: Array<{ email: string; id: string }> = [];
  const generalFailed: Array<{ email: string; error: string }> = [];
  const leadSent: Array<{ email: string; teamName: string; id: string }> = [];
  const leadFailed: Array<{ email: string; teamName: string; error: string }> = [];

  if (shouldMutatePlatform) {
    const { error: promoteError } = await supabase
      .from('teams')
      .update({ current_stage: 2 })
      .in('id', topTeamIds)
      .lt('current_stage', 2);
    if (promoteError) throw promoteError;

    const { data: existingFeedback, error: existingFeedbackError } = await supabase
      .from('feedback')
      .select('id,submission_id')
      .in('submission_id', topSubmissionIds)
      .is('deleted_at', null);
    if (existingFeedbackError) throw existingFeedbackError;

    const existingFeedbackBySubmission = new Map(
      (existingFeedback ?? []).map((row) => [row.submission_id, row.id]),
    );
    const feedbackToInsert = feedbackPayload.filter(
      (payload) => !existingFeedbackBySubmission.has(payload.submission_id),
    );
    const feedbackToUpdate = feedbackPayload.filter((payload) =>
      existingFeedbackBySubmission.has(payload.submission_id),
    );

    if (feedbackToInsert.length > 0) {
      const { error: feedbackInsertError } = await supabase.from('feedback').insert(feedbackToInsert);
      if (feedbackInsertError) throw feedbackInsertError;
    }

    for (const payload of feedbackToUpdate) {
      const feedbackId = existingFeedbackBySubmission.get(payload.submission_id);
      const { error: feedbackUpdateError } = await supabase
        .from('feedback')
        .update(payload)
        .eq('id', feedbackId);
      if (feedbackUpdateError) throw feedbackUpdateError;
    }

    const { error: submissionStatusError } = await supabase
      .from('submissions')
      .update({ status: 'feedback_published' })
      .in('id', topSubmissionIds);
    if (submissionStatusError) throw submissionStatusError;

    const { error: editionUpdateError } = await supabase
      .from('editions')
      .update({ active_stage: 2 })
      .eq('id', edition.id);
    if (editionUpdateError) throw editionUpdateError;
  }

  if (live) {
    for (const recipient of generalRecipients) {
      const email = renderGeneralEmail(recipient.name);
      try {
        const id = await sendBrevo({ to: recipient, ...email, tags: ['pidec-stage1-results-general'] });
        generalSent.push({ email: recipient.email, id });
      } catch (error) {
        generalFailed.push({ email: recipient.email, error: error instanceof Error ? error.message : 'unknown_error' });
      }
      await sleep(250);
    }

    for (const item of leadRecipients) {
      const email = renderLeadEmail(item.recipient.name, item.teamName);
      try {
        const id = await sendBrevo({ to: item.recipient, ...email, tags: ['pidec-stage1-results-team-leads'] });
        leadSent.push({ email: item.recipient.email, teamName: item.teamName, id });
      } catch (error) {
        leadFailed.push({ email: item.recipient.email, teamName: item.teamName, error: error instanceof Error ? error.message : 'unknown_error' });
      }
      await sleep(250);
    }
  }

  const report = {
    mode: live ? 'live' : 'dry-run',
    provider: 'brevo',
    edition: {
      id: edition.id,
      name: edition.name,
      activeStageBeforeRun: edition.active_stage,
      activeStageAfterLiveRun: live ? 2 : '(dry-run)',
    },
    platformMutation: {
      promoteTeamIds: topTeamIds,
      publishSubmissionIds: topSubmissionIds,
      setActiveStageTo: 2,
      opensSubmissionWindow: false,
      skippedBecauseTestRecipientWasProvided: Boolean(to),
    },
    totals: {
      rawActiveStudentRows: users?.length ?? 0,
      skippedTestOrInvalid: skippedRecipients.length,
      generalRecipients: generalRecipients.length,
      teamLeadRecipients: leadRecipients.length,
      topTeams: resolvedTopSubmissions.length,
      topTeamsMissingScores: missingScores.length,
      liveGeneralSent: generalSent.length,
      liveGeneralFailed: generalFailed.length,
      liveLeadSent: leadSent.length,
      liveLeadFailed: leadFailed.length,
    },
    topTeams: topTeams.map((item) => ({ ...item })),
    generalSample: generalRecipients.slice(0, 8).map((recipient) => ({
      name: recipient.name,
      email: recipient.email,
      hasTeam: Boolean(recipient.team_id),
    })),
    leadRecipients: leadRecipients.map((item) => ({
      name: item.recipient.name,
      email: item.recipient.email,
      teamName: item.teamName,
    })),
    generalFailed,
    leadFailed,
  };

  return report;
};

const main = async () => {
  const report = await launchStage1Results(parseArgs());
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  if (report.totals.liveGeneralFailed > 0 || report.totals.liveLeadFailed > 0) {
    process.exitCode = 1;
  }
};

const isDirectRun = process.argv[1]
  ? path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error) => {
  // eslint-disable-next-line no-console
    console.error('Stage 1 results launch failed:', error);
    process.exitCode = 1;
  });
}
