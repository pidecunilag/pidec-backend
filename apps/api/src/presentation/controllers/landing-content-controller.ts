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
