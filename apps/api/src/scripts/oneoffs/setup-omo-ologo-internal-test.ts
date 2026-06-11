import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase service env is not set');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const teamName = 'Omo Ologo';
const teamDepartment = 'Mechanical Engineering';

const scores = {
  problem_statement_clarity: 16,
  proposed_solution_quality: 23,
  theme_alignment: 17,
  feasibility_assessment: 15,
  departmental_relevance: 8,
};

const comments = {
  problem_statement_clarity:
    'The problem is understandable and locally relevant. Tighten the user pain point and quantify the impact more clearly for Stage 2.',
  proposed_solution_quality:
    'The solution direction is promising. Stage 2 should focus on a clearer prototype flow, evidence of technical choices, and a sharper explanation of how the system works.',
  theme_alignment:
    'The idea fits the competition theme. Make the inclusive and sustainability angles more explicit in the prototype narrative.',
  feasibility_assessment:
    'The proposal is feasible, but the implementation plan needs clearer milestones, materials/tools, and testing assumptions.',
  departmental_relevance:
    'The connection to Mechanical Engineering is present. Strengthen it by explaining the engineering principles and constraints behind the prototype.',
  overall:
    'This is internal test feedback for Omo Ologo. Use it to validate the Stage 2 dashboard, feedback visibility, and advanced-team flow without affecting real analytics.',
};

const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);

const main = async () => {
  const { data: edition, error: editionError } = await supabase
    .from('editions')
    .select('id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (editionError) throw editionError;
  if (!edition) throw new Error('No active edition found');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id,name,department,leader_id')
    .eq('edition_id', edition.id)
    .eq('name', teamName)
    .eq('department', teamDepartment)
    .is('deleted_at', null)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team) throw new Error(`${teamName} (${teamDepartment}) not found`);

  const { data: members, error: membersError } = await supabase
    .from('users')
    .select('id,email,name')
    .eq('team_id', team.id)
    .is('deleted_at', null);
  if (membersError) throw membersError;

  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .select('id,status')
    .eq('team_id', team.id)
    .eq('edition_id', edition.id)
    .eq('stage', 1)
    .is('deleted_at', null)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) throw new Error(`${teamName} Stage 1 submission not found`);

  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (adminError) throw adminError;

  const now = new Date().toISOString();

  const { error: teamUpdateError } = await supabase
    .from('teams')
    .update({
      current_stage: 2,
      is_stage_2_representative: false,
    } as never)
    .eq('id', team.id);
  if (teamUpdateError) throw teamUpdateError;

  const memberIds = (members ?? []).map((member) => member.id);

  const feedbackPayload = {
    submission_id: submission.id,
    scores,
    comments,
    total_score: totalScore,
    outcome: 'advanced',
    entered_by_admin: admin.id,
    evaluator_name: 'PIDEC Internal Test',
    evaluation_date: now.slice(0, 10),
    published: true,
    published_at: now,
    published_by: admin.id,
  };

  const { data: existingFeedback, error: existingFeedbackError } = await supabase
    .from('feedback')
    .select('id')
    .eq('submission_id', submission.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (existingFeedbackError) throw existingFeedbackError;

  if (existingFeedback) {
    const { error: feedbackUpdateError } = await supabase
      .from('feedback')
      .update(feedbackPayload as never)
      .eq('id', existingFeedback.id);
    if (feedbackUpdateError) throw feedbackUpdateError;
  } else {
    const { error: feedbackInsertError } = await supabase
      .from('feedback')
      .insert([feedbackPayload] as never[]);
    if (feedbackInsertError) throw feedbackInsertError;
  }

  const { error: submissionUpdateError } = await supabase
    .from('submissions')
    .update({ status: 'feedback_published' } as never)
    .eq('id', submission.id);
  if (submissionUpdateError) throw submissionUpdateError;

  console.log(
    JSON.stringify(
      {
        team: { id: team.id, name: team.name, department: team.department },
        members: memberIds.length,
        submission: { id: submission.id, status: 'feedback_published' },
        feedback: { published: true, totalScore },
        currentStage: 2,
        isStage2Representative: false,
        internalTestExclusion: 'team id is excluded in API code',
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('Failed to set up Omo Ologo internal test:', error);
  process.exitCode = 1;
});
