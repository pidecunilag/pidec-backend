import { type RequestHandler } from 'express';
import { ERROR_CODES } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { getEmailService } from '../../infrastructure/email/resend-email-service.js';
import { fireAndForget } from '../../infrastructure/email/async-dispatch.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';

const EVENT_DATE = 'Friday, 28 August 2026';
const EVENT_VENUE = 'J.F. Ajayi Auditorium, University of Lagos';
const WHATSAPP_URL = 'https://chat.whatsapp.com/Fs4FQGkmTE48dAwt6fb4DY';

type FinaleRegistrationRow = {
  id: string;
  registration_number: string;
  full_name: string;
  email: string;
  phone: string;
  admitted_at: string | null;
  admitted_by: string | null;
  created_at: string;
  updated_at: string;
};

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  throw AppError.validation('Enter a valid phone number', { field: 'phone' });
};

const firstNameOf = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

export const createFinaleRegistration: RequestHandler = async (req, res, next) => {
  try {
    const { fullName, email, phone } = req.body as {
      fullName: string;
      email: string;
      phone: string;
    };
    const supabase = getSupabaseService() as any;
    const normalizedPhone = normalizePhone(phone);

    const { data, error } = await supabase
      .from('finale_registrations')
      .insert({
        full_name: fullName.trim().replace(/\s+/g, ' '),
        email: email.trim().toLowerCase(),
        phone: normalizedPhone,
      })
      .select('*')
      .single();

    if (error) {
      const details = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
      if (error.code === '23505' && details.includes('email')) {
        throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'This email is already registered.', {
          field: 'email',
        });
      }
      if (error.code === '23505' && details.includes('phone')) {
        throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'This phone number is already registered.', {
          field: 'phone',
        });
      }
      throw error;
    }

    const registration = data as FinaleRegistrationRow;
    fireAndForget(
      getEmailService().sendFinaleRegistrationConfirmed(
        { to: registration.email, name: registration.full_name },
        {
          recipientName: firstNameOf(registration.full_name),
          registrationNumber: registration.registration_number,
          eventDate: EVENT_DATE,
          eventVenue: EVENT_VENUE,
          finaleUrl: `${env.APP_URL.replace(/\/$/, '')}/finale`,
          whatsappUrl: WHATSAPP_URL,
        },
      ),
      `finale registration confirmation for ${registration.id}`,
    );

    res.status(201).json({
      status: 'success',
      data: {
        id: registration.id,
        registrationNumber: registration.registration_number,
        fullName: registration.full_name,
        firstName: firstNameOf(registration.full_name),
        email: registration.email,
        phone: registration.phone,
        createdAt: registration.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const applyStatusFilter = (query: any, status: string) => {
  if (status === 'admitted') return query.not('admitted_at', 'is', null);
  if (status === 'awaiting') return query.is('admitted_at', null);
  return query;
};

const applySearch = (query: any, rawSearch?: string) => {
  if (!rawSearch) return query;
  const search = rawSearch.replace(/[^a-zA-Z0-9@+ ._-]/g, ' ').trim();
  if (!search) return query;
  return query.or(
    `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,registration_number.ilike.%${search}%`,
  );
};

const countFinaleRegistrations = async (supabase: any, admitted: boolean | null) => {
  let query = supabase.from('finale_registrations').select('id', { count: 'exact', head: true });
  query = admitted === true
    ? query.not('admitted_at', 'is', null)
    : admitted === false
      ? query.is('admitted_at', null)
      : query;
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

export const listFinaleRegistrations: RequestHandler = async (req, res, next) => {
  try {
    const { q, status = 'all', page = 1, limit = 25 } = req.query as unknown as {
      q?: string;
      status?: 'all' | 'admitted' | 'awaiting';
      page?: number;
      limit?: number;
    };
    const supabase = getSupabaseService() as any;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('finale_registrations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    query = applyStatusFilter(applySearch(query, q), status);

    const [{ data, count, error }, total, admitted, awaiting] = await Promise.all([
      query,
      countFinaleRegistrations(supabase, null),
      countFinaleRegistrations(supabase, true),
      countFinaleRegistrations(supabase, false),
    ]);
    if (error) throw error;

    res.json({
      status: 'success',
      data: {
        registrations: data ?? [],
        stats: { total, admitted, awaiting },
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const setFinaleAdmission: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw AppError.unauthenticated();
    const { registrationId } = req.params as { registrationId: string };
    const { admitted } = req.body as { admitted: boolean };
    const supabase = getSupabaseService() as any;

    const { data: before, error: readError } = await supabase
      .from('finale_registrations')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) throw AppError.notFound('Finale registration not found');

    const admissionUpdate = admitted
      ? { admitted_at: new Date().toISOString(), admitted_by: req.user.id }
      : { admitted_at: null, admitted_by: null };
    const { data: updated, error: updateError } = await supabase
      .from('finale_registrations')
      .update(admissionUpdate)
      .eq('id', registrationId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const { error: logError } = await supabase.from('admin_logs').insert({
      admin_id: req.user.id,
      action: admitted ? 'finale_admit' : 'finale_unadmit',
      target_type: 'finale_registration',
      target_id: registrationId,
      before_value: { admitted_at: before.admitted_at, admitted_by: before.admitted_by },
      after_value: { admitted_at: updated.admitted_at, admitted_by: updated.admitted_by },
      ip_address: req.ip,
      user_agent: req.get('user-agent') ?? null,
    });
    if (logError) throw logError;

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportFinaleRegistrations: RequestHandler = async (_req, res, next) => {
  try {
    const supabase = getSupabaseService() as any;
    const { data, error } = await supabase
      .from('finale_registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const header = ['Registration Number', 'Full Name', 'Email', 'Phone', 'Registered At', 'Status', 'Admitted At'];
    const rows = (data ?? []).map((row: FinaleRegistrationRow) => [
      row.registration_number,
      row.full_name,
      row.email,
      row.phone,
      row.created_at,
      row.admitted_at ? 'Admitted' : 'Awaiting admission',
      row.admitted_at ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pidec-finale-registrations.csv"');
    res.status(200).send(`\ufeff${csv}`);
  } catch (error) {
    next(error);
  }
};
