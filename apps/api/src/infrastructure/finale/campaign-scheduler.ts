import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseService } from '../db/supabase.js';
import { getEmailService } from '../email/resend-email-service.js';
import { logger } from '../../shared/logger/index.js';
import { env } from '../../shared/config/env.js';
import { isFinaleTomorrowCampaignActive } from './campaign-schedule.js';

const CAMPAIGN_KEY = 'finale-tomorrow-midnight';
const FINALE_URL = 'https://pidec.com.ng/finale';
const WHATSAPP_URL = 'https://chat.whatsapp.com/Fs4FQGkmTE48dAwt6fb4DY';
const POLL_INTERVAL_MS = 60_000;
const SEND_DELAY_MS = 350;
const BATCH_SIZE = 100;

type ClaimedRecipient = {
  delivery_id: string;
  registration_id: string;
  full_name: string;
  email: string;
};

type CampaignDatabase = {
  public: {
    Tables: {
      finale_campaign_deliveries: {
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
      claim_finale_campaign_recipients: {
        Args: { p_campaign_key: string; p_limit?: number };
        Returns: ClaimedRecipient[];
      };
    };
  };
};

const getCampaignClient = () =>
  getSupabaseService() as unknown as SupabaseClient<CampaignDatabase>;
const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const markDelivery = async (
  deliveryId: string,
  status: 'sent' | 'failed',
  providerId: string,
  errorMessage?: string,
) => {
  const { error } = await getCampaignClient()
    .from('finale_campaign_deliveries')
    .update({
      status,
      provider_id: providerId || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      last_error: errorMessage ?? null,
    })
    .eq('id', deliveryId);
  if (error) throw error;
};

const sendClaimedBatch = async (recipients: ClaimedRecipient[]) => {
  const emailService = getEmailService();
  for (const recipient of recipients) {
    try {
      const result = await emailService.sendFinaleTomorrowCampaign(
        { to: recipient.email, name: recipient.full_name },
        {
          recipientName: firstNameOf(recipient.full_name),
          finaleUrl: FINALE_URL,
          whatsappUrl: WHATSAPP_URL,
        },
      );
      await markDelivery(
        recipient.delivery_id,
        result.delivered ? 'sent' : 'failed',
        result.id,
        result.delivered ? undefined : 'Email provider did not accept the campaign message',
      );
    } catch (error) {
      logger.error(
        { err: error, registrationId: recipient.registration_id, campaignKey: CAMPAIGN_KEY },
        'Finale campaign dispatch failed',
      );
      await markDelivery(
        recipient.delivery_id,
        'failed',
        '',
        error instanceof Error ? error.message : 'Unknown campaign dispatch error',
      ).catch((markError) => {
        logger.error(
          { err: markError, deliveryId: recipient.delivery_id },
          'Could not mark finale campaign failure',
        );
      });
    }
    await wait(SEND_DELAY_MS);
  }
};

let isRunning = false;

export const runFinaleCampaignTick = async (now = new Date()) => {
  if (!isFinaleTomorrowCampaignActive(now) || isRunning) return;

  isRunning = true;
  let processed = 0;
  try {
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await getCampaignClient().rpc('claim_finale_campaign_recipients', {
        p_campaign_key: CAMPAIGN_KEY,
        p_limit: BATCH_SIZE,
      });
      if (error) throw error;

      const recipients = (data ?? []) as ClaimedRecipient[];
      if (recipients.length === 0) break;
      await sendClaimedBatch(recipients);
      processed += recipients.length;
      hasMore = recipients.length === BATCH_SIZE;
    }
    if (processed > 0) {
      logger.info({ campaignKey: CAMPAIGN_KEY, processed }, 'Finale campaign batch processed');
    }
  } catch (error) {
    logger.error({ err: error, campaignKey: CAMPAIGN_KEY }, 'Finale campaign tick failed');
  } finally {
    isRunning = false;
  }
};

export const startFinaleCampaignScheduler = () => {
  if (env.NODE_ENV !== 'production') return () => undefined;

  void runFinaleCampaignTick();
  const interval = setInterval(() => void runFinaleCampaignTick(), POLL_INTERVAL_MS);
  interval.unref();
  logger.info(
    { campaignKey: CAMPAIGN_KEY, scheduledFor: '2026-08-28 00:01 WAT' },
    'Finale campaign scheduler started',
  );
  return () => clearInterval(interval);
};
