import { type RequestHandler } from 'express';
import { DEPARTMENTS, type LandingData } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { AppError } from '../../shared/errors/app-error.js';

const getActiveEdition = async () => {
  const supabase = getSupabaseService() as any;
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw AppError.notFound('No active edition configured');
  return data;
};

const mapAsset = (row: any) => ({
  id: row.id,
  editionId: row.edition_id,
  name: row.name,
  logoUrl: row.logo_url,
  websiteUrl: row.website_url ?? null,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at ?? null,
});

const mapFaq = (row: any) => ({
  id: row.id,
  editionId: row.edition_id,
  question: row.question,
  answer: row.answer,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at ?? null,
});

const isMissingTableError = (error: unknown): boolean => {
  let message: string;
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;
  else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }
  return /could not find the table|schema cache/i.test(message.toLowerCase());
};

const listByTable = async <T>(
  table: string,
  editionId: string,
  mapper: (row: any) => T,
): Promise<T[]> => {
  try {
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('edition_id', editionId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? []).map(mapper);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
};

const upsertAsset = async (table: string, editionId: string, body: any) => {
  try {
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from(table)
      .insert([
        {
          edition_id: editionId,
          name: body.name,
          logo_url: body.logoUrl,
          website_url: body.websiteUrl ?? null,
          sort_order: body.sortOrder ?? 0,
          is_active: body.isActive ?? true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) throw error;
    return mapAsset(data);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw AppError.notFound(
        'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
      );
    }
    throw error;
  }
};

const updateAsset = async (table: string, editionId: string, id: string, body: any) => {
  try {
    const supabase = getSupabaseService() as any;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.logoUrl !== undefined) patch.logo_url = body.logoUrl;
    if (body.websiteUrl !== undefined) patch.website_url = body.websiteUrl;
    if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
    if (body.isActive !== undefined) patch.is_active = body.isActive;

    const { data, error } = await supabase
      .from(table)
      .update(patch as never)
      .eq('id', id)
      .eq('edition_id', editionId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return mapAsset(data);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw AppError.notFound(
        'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
      );
    }
    throw error;
  }
};

const softDelete = async (table: string, editionId: string, id: string) => {
  try {
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', id)
      .eq('edition_id', editionId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return mapAsset(data);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw AppError.notFound(
        'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
      );
    }
    throw error;
  }
};

const publicLandingData = async (): Promise<LandingData> => {
  const edition = await getActiveEdition();
  const [sponsors, partners, faqs] = await Promise.all([
    listByTable('landing_sponsors', edition.id, mapAsset),
    listByTable('landing_partners', edition.id, mapAsset),
    listByTable('landing_faqs', edition.id, mapFaq),
  ]);

  return {
    edition: {
      id: edition.id,
      name: edition.name,
      theme: edition.theme,
      activeStage: edition.active_stage,
      signupOpen: edition.signup_open,
      teamManagementLocked: edition.team_management_locked,
      submissionWindowOpen: edition.submission_window_open,
      isActive: edition.is_active,
      announcementBanner: edition.announcement_banner,
      createdAt: edition.created_at,
      updatedAt: edition.updated_at,
      deletedAt: edition.deleted_at,
    },
    sponsors,
    partners,
    faqs,
    departments: [...DEPARTMENTS],
    announcementBanner: edition.announcement_banner,
  };
};

export const getLandingData: RequestHandler = async (_req, res, next) => {
  try {
    const data = await publicLandingData();
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    // If the landing tables haven't been applied in the live DB yet,
    // return an empty-but-valid structure so the public homepage can still load.
    try {
      if (isMissingTableError(err)) {
        const edition = await getActiveEdition();
        const fallback: Partial<LandingData> = {
          edition: {
            id: edition.id,
            name: edition.name,
            theme: edition.theme,
            activeStage: edition.active_stage,
            signupOpen: edition.signup_open,
            teamManagementLocked: edition.team_management_locked,
            submissionWindowOpen: edition.submission_window_open,
            isActive: edition.is_active,
            announcementBanner: edition.announcement_banner,
            createdAt: edition.created_at,
            updatedAt: edition.updated_at,
            deletedAt: edition.deleted_at,
          },
          sponsors: [],
          partners: [],
          faqs: [],
          departments: [...DEPARTMENTS],
          announcementBanner: edition.announcement_banner,
        };

        res.status(200).json({ status: 'success', data: fallback });
        return;
      }
    } catch {
      // fall through to error handler if fallback can't be built
    }

    next(err);
  }
};

export const exportStudents: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('users')
      .select(
        'id,name,email,matric_number,department,level,verification_status,verification_method,verification_timestamp,is_suspended,team_id,role,created_at',
      )
      .eq('role', 'student')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows: Array<{
      id: string;
      name: string;
      email: string;
      matric_number: string;
      department: string;
      level: number;
      verification_status: string;
      verification_method: string;
      verification_timestamp: string;
      is_suspended: boolean;
      team_id: string;
      role: string;
      created_at: string;
      edition_id: string;
    }> = (data ?? []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      matric_number: user.matric_number,
      department: user.department,
      level: user.level,
      verification_status: user.verification_status,
      verification_method: user.verification_method ?? '',
      verification_timestamp: user.verification_timestamp ?? '',
      is_suspended: user.is_suspended,
      team_id: user.team_id ?? '',
      role: user.role,
      created_at: user.created_at,
      edition_id: edition.id,
    }));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pidec-students-${edition.id}.csv"`);
    res.status(200).send(
      ['id,name,email,matric_number,department,level,verification_status,verification_method,verification_timestamp,is_suspended,team_id,role,created_at,edition_id',
        ...rows.map((row) => [
          row.id,
          row.name,
          row.email,
          row.matric_number,
          row.department,
          row.level,
          row.verification_status,
          row.verification_method,
          row.verification_timestamp,
          row.is_suspended,
          row.team_id,
          row.role,
          row.created_at,
          row.edition_id,
        ].map((value) => JSON.stringify(value ?? '')).join(','))].join('\n') + '\n',
    );
  } catch (err) {
    next(err);
  }
};

export const exportTeams: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('teams')
      .select('*, leader:users!teams_leader_id_fkey(id,name,email), submissions(id,stage,status,submitted_at)', { count: 'exact' })
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows: Array<{
      id: string;
      edition_id: string;
      name: string;
      department: string;
      leader_id: string;
      leader_name: string;
      leader_email: string;
      current_stage: number;
      status: string;
      disqualified_at_stage: string | number;
      disqualified_at: string;
      disqualified_reason: string;
      is_stage_2_representative: boolean;
      member_count: number;
      submission_count: number;
      created_at: string;
    }> = (data ?? []).map((team: any) => ({
      id: team.id,
      edition_id: team.edition_id,
      name: team.name,
      department: team.department,
      leader_id: team.leader_id,
      leader_name: team.leader?.name ?? '',
      leader_email: team.leader?.email ?? '',
      current_stage: team.current_stage,
      status: team.status,
      disqualified_at_stage: team.disqualified_at_stage ?? '',
      disqualified_at: team.disqualified_at ?? '',
      disqualified_reason: team.disqualified_reason ?? '',
      is_stage_2_representative: team.is_stage_2_representative,
      member_count: 0,
      submission_count: Array.isArray(team.submissions) ? team.submissions.length : 0,
      created_at: team.created_at,
    }));

    const teamIds = rows.map((row: { id: string }) => row.id);
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select('team_id')
        .in('team_id', teamIds)
        .is('deleted_at', null);

      if (membersError) throw membersError;

      const memberCounts = new Map<string, number>();
      for (const row of members ?? []) {
        const teamId = (row as { team_id: string | null }).team_id;
        if (!teamId) continue;
        memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
      }

      for (const row of rows) {
        row.member_count = memberCounts.get(row.id as string) ?? 0;
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pidec-teams-${edition.id}.csv"`);
    res.status(200).send(
      [
        'id,edition_id,name,department,leader_id,leader_name,leader_email,current_stage,status,disqualified_at_stage,disqualified_at,disqualified_reason,is_stage_2_representative,member_count,submission_count,created_at',
        ...rows.map((row) => [
          row.id,
          row.edition_id,
          row.name,
          row.department,
          row.leader_id,
          row.leader_name,
          row.leader_email,
          row.current_stage,
          row.status,
          row.disqualified_at_stage,
          row.disqualified_at,
          row.disqualified_reason,
          row.is_stage_2_representative,
          row.member_count,
          row.submission_count,
          row.created_at,
        ].map((value) => JSON.stringify(value ?? '')).join(','))
      ].join('\n') + '\n',
    );
  } catch (err) {
    next(err);
  }
};

export const exportSubmissions: RequestHandler = async (req, res, next) => {
  try {
    const { stage } = req.query as any;
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    let query = supabase
      .from('submissions')
      .select('*, teams!inner(id,name,department,leader_id), users!submissions_submitted_by_fkey(id,name,email)', {
        count: 'exact',
      })
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true });

    if (typeof stage === 'number') query = query.eq('stage', stage);

    const { data, error } = await query;
    if (error) throw error;

    const rows: Array<{
      id: string;
      team_id: string;
      team_name: string;
      team_department: string;
      edition_id: string;
      submitted_by: string;
      submitted_by_name: string;
      submitted_by_email: string;
      stage: number;
      status: string;
      is_locked: boolean;
      token_id: string;
      video_link: string;
      form_data: unknown;
      files: unknown;
      submitted_at: string;
      created_at: string;
    }> = (data ?? []).map((submission: any) => ({
      id: submission.id,
      team_id: submission.team_id,
      team_name: submission.teams?.name ?? '',
      team_department: submission.teams?.department ?? '',
      edition_id: submission.edition_id,
      submitted_by: submission.submitted_by,
      submitted_by_name: submission.users?.name ?? '',
      submitted_by_email: submission.users?.email ?? '',
      stage: submission.stage,
      status: submission.status,
      is_locked: submission.is_locked,
      token_id: submission.token_id ?? '',
      video_link: submission.video_link ?? '',
      form_data: submission.form_data,
      files: submission.files,
      submitted_at: submission.submitted_at,
      created_at: submission.created_at,
    }));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pidec-submissions-${edition.id}${typeof stage === 'number' ? `-stage-${stage}` : ''}.csv"`);
    res.status(200).send(
      [
        'id,team_id,team_name,team_department,edition_id,submitted_by,submitted_by_name,submitted_by_email,stage,status,is_locked,token_id,video_link,form_data,files,submitted_at,created_at',
        ...rows.map((row) => [
          row.id,
          row.team_id,
          row.team_name,
          row.team_department,
          row.edition_id,
          row.submitted_by,
          row.submitted_by_name,
          row.submitted_by_email,
          row.stage,
          row.status,
          row.is_locked,
          row.token_id,
          row.video_link,
          row.form_data,
          row.files,
          row.submitted_at,
          row.created_at,
        ].map((value) => JSON.stringify(value ?? '')).join(','))
      ].join('\n') + '\n',
    );
  } catch (err) {
    next(err);
  }
};

export const exportScores: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const edition = await getActiveEdition();

    const { data, error } = await supabase
      .from('judge_scores')
      .select(
        'id,submission_id,judge_id,scores,comments,total_score,is_representative_pick,submitted_at,submissions!inner(id,team_id,stage,teams!inner(id,name,department)),judges!inner(id,name,email,stage_scope)',
      )
      .is('deleted_at', null)
      .eq('submissions.edition_id', edition.id)
      .order('submitted_at', { ascending: true });

    if (error) throw error;

    const rows: Array<{
      id: string;
      submission_id: string;
      team_id: string;
      team_name: string;
      team_department: string;
      submission_stage: string | number;
      judge_id: string;
      judge_name: string;
      judge_email: string;
      judge_stage_scope: string;
      scores: unknown;
      comments: unknown;
      total_score: string | number;
      is_representative_pick: boolean;
      submitted_at: string;
      edition_id: string;
    }> = (data ?? []).map((score: any) => ({
      id: score.id,
      submission_id: score.submission_id,
      team_id: score.submissions?.team_id ?? '',
      team_name: score.submissions?.teams?.name ?? '',
      team_department: score.submissions?.teams?.department ?? '',
      submission_stage: score.submissions?.stage ?? '',
      judge_id: score.judge_id,
      judge_name: score.judges?.name ?? '',
      judge_email: score.judges?.email ?? '',
      judge_stage_scope: score.judges?.stage_scope ?? '',
      scores: score.scores,
      comments: score.comments,
      total_score: score.total_score ?? '',
      is_representative_pick: score.is_representative_pick,
      submitted_at: score.submitted_at,
      edition_id: edition.id,
    }));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pidec-scores-${edition.id}.csv"`);
    res.status(200).send(
      [
        'id,submission_id,team_id,team_name,team_department,submission_stage,judge_id,judge_name,judge_email,judge_stage_scope,scores,comments,total_score,is_representative_pick,submitted_at,edition_id',
        ...rows.map((row) => [
          row.id,
          row.submission_id,
          row.team_id,
          row.team_name,
          row.team_department,
          row.submission_stage,
          row.judge_id,
          row.judge_name,
          row.judge_email,
          row.judge_stage_scope,
          row.scores,
          row.comments,
          row.total_score,
          row.is_representative_pick,
          row.submitted_at,
          row.edition_id,
        ].map((value) => JSON.stringify(value ?? '')).join(','))
      ].join('\n') + '\n',
    );
  } catch (err) {
    next(err);
  }
};

export const listSponsors: RequestHandler = async (_req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const sponsors = await listByTable('landing_sponsors', edition.id, mapAsset);
    res.status(200).json({ status: 'success', data: { sponsors } });
  } catch (err) {
    next(err);
  }
};

export const createSponsor: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const sponsor = await upsertAsset('landing_sponsors', edition.id, req.body);
    res.status(201).json({ status: 'success', data: { sponsor } });
  } catch (err) {
    next(err);
  }
};

export const updateSponsor: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { sponsorId } = req.params as { sponsorId: string };
    const sponsor = await updateAsset('landing_sponsors', edition.id, sponsorId, req.body);
    res.status(200).json({ status: 'success', data: { sponsor } });
  } catch (err) {
    next(err);
  }
};

export const deleteSponsor: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { sponsorId } = req.params as { sponsorId: string };
    const sponsor = await softDelete('landing_sponsors', edition.id, sponsorId);
    res.status(200).json({ status: 'success', data: { sponsor } });
  } catch (err) {
    next(err);
  }
};

export const listPartners: RequestHandler = async (_req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const partners = await listByTable('landing_partners', edition.id, mapAsset);
    res.status(200).json({ status: 'success', data: { partners } });
  } catch (err) {
    next(err);
  }
};

export const createPartner: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const partner = await upsertAsset('landing_partners', edition.id, req.body);
    res.status(201).json({ status: 'success', data: { partner } });
  } catch (err) {
    next(err);
  }
};

export const updatePartner: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { partnerId } = req.params as { partnerId: string };
    const partner = await updateAsset('landing_partners', edition.id, partnerId, req.body);
    res.status(200).json({ status: 'success', data: { partner } });
  } catch (err) {
    next(err);
  }
};

export const deletePartner: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { partnerId } = req.params as { partnerId: string };
    const partner = await softDelete('landing_partners', edition.id, partnerId);
    res.status(200).json({ status: 'success', data: { partner } });
  } catch (err) {
    next(err);
  }
};

export const listFaqs: RequestHandler = async (_req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const faqs = await listByTable('landing_faqs', edition.id, mapFaq);
    res.status(200).json({ status: 'success', data: { faqs } });
  } catch (err) {
    next(err);
  }
};

export const createFaq: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from('landing_faqs')
      .insert([
        {
          edition_id: edition.id,
          question: req.body.question,
          answer: req.body.answer,
          sort_order: req.body.sortOrder ?? 0,
          is_active: req.body.isActive ?? true,
        },
      ] as never[])
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
        );
      }
      throw error;
    }

    res.status(201).json({ status: 'success', data: { faq: mapFaq(data) } });
  } catch (err) {
    next(err);
  }
};

export const updateFaq: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { faqId } = req.params as { faqId: string };
    const supabase = getSupabaseService() as any;
    const patch: Record<string, unknown> = {};
    if (req.body.question !== undefined) patch.question = req.body.question;
    if (req.body.answer !== undefined) patch.answer = req.body.answer;
    if (req.body.sortOrder !== undefined) patch.sort_order = req.body.sortOrder;
    if (req.body.isActive !== undefined) patch.is_active = req.body.isActive;

    const { data, error } = await supabase
      .from('landing_faqs')
      .update(patch as never)
      .eq('id', faqId)
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
        );
      }
      throw error;
    }

    res.status(200).json({ status: 'success', data: { faq: mapFaq(data) } });
  } catch (err) {
    next(err);
  }
};

export const deleteFaq: RequestHandler = async (req, res, next) => {
  try {
    const edition = await getActiveEdition();
    const { faqId } = req.params as { faqId: string };
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from('landing_faqs')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', faqId)
      .eq('edition_id', edition.id)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        throw AppError.notFound(
          'Landing content tables are unavailable until migration 0021_landing_content.sql is applied',
        );
      }
      throw error;
    }

    res.status(200).json({ status: 'success', data: { faq: mapFaq(data) } });
  } catch (err) {
    next(err);
  }
};
