import type { FinaleReminderType } from '../../domain/services/email-service.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/logger/index.js';
import { getSupabaseService } from '../db/supabase.js';
import { getEmailService } from '../email/resend-email-service.js';
import { getActiveFinaleReminder } from './reminder-schedule.js';

const EVENT_DATE = 'Friday, 28 August 2026';
const EVENT_TIME = '9:00 AM';
const EVENT_VENUE = 'J.F. Ajayi Auditorium, University of Lagos';
const WHATSAPP_URL = 'https://chat.whatsapp.com/Fs4FQGkmTE48dAwt6fb4DY';
const POLL_INTERVAL_MS = 5 * 60 * 1_000;
const SEND_DELAY_MS = 350;
const BATCH_SIZE = 100;

type ClaimedRecipient = {
  delivery_id: string;
  registration_id: string;
  registration_number: string;
  full_name: string;
  email: string;
};

type FinaleReminderDatabase = {
  public: {
    Tables: {
      finale_reminder_deliveries: {
        Row: {
          id: string;
          status: 'pending' | 'sent' | 'failed';
          provider_id: string | null;
          sent_at: string | null;
          last_error: string | null;
        };
        Insert: Record<string, never>;
        Update: {
          status?: 'pending' | 'sent' | 'failed';
          provider_id?: string | null;
          sent_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_finale_reminder_recipients: {
        Args: { p_reminder_key: string; p_limit?: number };
        Returns: ClaimedRecipient[];
      };
    };
  };
};

const getFinaleReminderClient = () =>
  getSupabaseService() as unknown as SupabaseClient<FinaleReminderDatabase>;

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const markDelivery = async (
  deliveryId: string,
  status: 'sent' | 'failed',
  providerId: string,
  errorMessage?: string,
) => {
  const supabase = getFinaleReminderClient();
  const { error } = await supabase
    .from('finale_reminder_deliveries')
    .update({
      status,
      provider_id: providerId || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      last_error: errorMessage ?? null,
    })
    .eq('id', deliveryId);
  if (error) throw error;
};

const sendClaimedBatch = async (
  reminderType: FinaleReminderType,
  recipients: ClaimedRecipient[],
) => {
  const emailService = getEmailService();

  for (const recipient of recipients) {
    try {
      const result = await emailService.sendFinaleReminder(
        { to: recipient.email, name: recipient.full_name },
        {
          recipientName: firstNameOf(recipient.full_name),
          registrationNumber: recipient.registration_number,
          eventDate: EVENT_DATE,
          eventTime: EVENT_TIME,
          eventVenue: EVENT_VENUE,
          finaleUrl: `${env.APP_URL.replace(/\/$/, '')}/finale/card`,
          whatsappUrl: WHATSAPP_URL,
          reminderType,
        },
      );
      await markDelivery(
        recipient.delivery_id,
        result.delivered ? 'sent' : 'failed',
        result.id,
        result.delivered ? undefined : 'Email provider did not accept the message',
      );
    } catch (error) {
      logger.error(
        { err: error, registrationId: recipient.registration_id, reminderType },
        'Finale reminder dispatch failed',
      );
      await markDelivery(
        recipient.delivery_id,
        'failed',
        '',
        error instanceof Error ? error.message : 'Unknown dispatch error',
      ).catch((markError) => {
        logger.error(
          { err: markError, deliveryId: recipient.delivery_id },
          'Could not mark reminder failure',
        );
      });
    }
    await wait(SEND_DELAY_MS);
  }
};

let isRunning = false;

export const runFinaleReminderTick = async (now = new Date()) => {
  const reminderType = getActiveFinaleReminder(now);
  if (!reminderType || isRunning) return;

  isRunning = true;
  let delivered = 0;
  try {
    const supabase = getFinaleReminderClient();
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.rpc('claim_finale_reminder_recipients', {
        p_reminder_key: reminderType,
        p_limit: BATCH_SIZE,
      });
      if (error) throw error;

      const recipients = (data ?? []) as ClaimedRecipient[];
      if (recipients.length === 0) break;
      await sendClaimedBatch(reminderType, recipients);
      delivered += recipients.length;
      hasMore = recipients.length === BATCH_SIZE;
    }
    if (delivered > 0) {
      logger.info({ reminderType, processed: delivered }, 'Finale reminder batch processed');
    }
  } catch (error) {
    logger.error({ err: error, reminderType }, 'Finale reminder scheduler tick failed');
  } finally {
    isRunning = false;
  }
};

export const startFinaleReminderScheduler = () => {
  if (env.NODE_ENV !== 'production') return () => undefined;

  void runFinaleReminderTick();
  const interval = setInterval(() => void runFinaleReminderTick(), POLL_INTERVAL_MS);
  interval.unref();
  logger.info('Finale reminder scheduler started');
  return () => clearInterval(interval);
};
