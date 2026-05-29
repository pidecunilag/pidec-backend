import 'dotenv/config';
import { Heading, Link, Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { EmailLayout } from '../../infrastructure/email/templates/_layout.js';

type Recipient = {
  name: string;
  email: string;
};

type RawEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

const subject = 'Join the official PIDEC 1.0 WhatsApp group';
const preview = 'Get PIDEC 1.0 updates, reminders, and support in one place.';
const whatsappUrl = 'https://chat.whatsapp.com/DXlFJRS5jmd8FzCA3Mmr2I?mode=gi_t';
const campaignSince = new Date('2026-05-28T13:00:00.000Z');
const recipientsFile = path.resolve(
  process.cwd(),
  '..',
  '..',
  'whatsapp-group-unsent-recipients-2026-05-28.m.md',
);

const parseArgs = () => ({
  live: process.argv.includes('--live'),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string | URL, options: RequestInit, attempts = 5) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
      await sleep(1_500 * attempt);
    }
  }
  throw lastError;
};

const parseResendDate = (value: string) =>
  new Date(value.replace(' ', 'T').replace(/\+(\d{2})$/, '+$1:00'));

const normalizeEmail = (value: unknown) => {
  const text = String(value ?? '').trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] ?? text).trim().toLowerCase();
};

const parseEmailAddress = (address: string) => {
  const trimmed = address.trim();
  const match = trimmed.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (!match) return { email: trimmed };

  const name = match[1]?.trim();
  return {
    email: match[2]?.trim() ?? trimmed,
    ...(name ? { name } : {}),
  };
};

const sendWithBrevoFallback = async (payload: RawEmailPayload[]) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    return {
      provider: 'brevo',
      attempted: 0,
      sent: 0,
      failed: payload.length,
      skipped: true,
      reason: 'BREVO_API_KEY is not set',
    };
  }

  const sender = parseEmailAddress(
    process.env.BREVO_FROM_EMAIL ??
      process.env.RESEND_FROM_EMAIL ??
      'PIDEC 1.0 <competitions@pidec.com.ng>',
  );
  const sent: Array<{ to: string; messageId: string | null }> = [];
  const failed: Array<{ to: string; status?: number; body?: string; error?: string }> = [];

  for (const item of payload) {
    let response: Response;
    try {
      response = await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: item.to.map((recipient) => parseEmailAddress(recipient)),
          subject: item.subject,
          htmlContent: item.html,
          textContent: item.text,
        }),
      });
    } catch (err) {
      failed.push({ to: item.to.join(', '), error: err instanceof Error ? err.message : 'unknown_error' });
      continue;
    }

    const rawBody = await response.text();
    if (!response.ok) {
      failed.push({ to: item.to.join(', '), status: response.status, body: rawBody });
      continue;
    }

    let messageId: string | null = null;
    try {
      messageId = (JSON.parse(rawBody) as { messageId?: string }).messageId ?? null;
    } catch {
      messageId = null;
    }
    sent.push({ to: item.to.join(', '), messageId });
    await sleep(250);
  }

  return {
    provider: 'brevo',
    attempted: payload.length,
    sent: sent.length,
    failed: failed.length,
    skipped: false,
    sentRecipients: sent,
    failedRecipients: failed,
  };
};

const parseRecipientsFile = async (): Promise<Recipient[]> => {
  const markdown = await readFile(recipientsFile, 'utf8');
  const recipients: Recipient[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    if (line.includes('|---')) continue;

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    const [index, name, email] = cells;
    if (!index || Number.isNaN(Number(index)) || !name || !email || !email.includes('@')) continue;

    recipients.push({ name, email });
  }

  const unique = new Map<string, Recipient>();
  for (const recipient of recipients) {
    const normalized = recipient.email.trim().toLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, { ...recipient, email: recipient.email.trim() });
  }
  return [...unique.values()];
};

const listAlreadySentCampaignEmails = async () => {
  const sentEmails = new Set<string>();
  let after: string | null = null;

  for (let page = 0; page < 10; page += 1) {
    const url = new URL('https://api.resend.com/emails');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);

    const response = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    const body = (await response.json()) as {
      data?: Array<{ id: string; subject: string; created_at: string; to?: string[] }>;
      has_more?: boolean;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(JSON.stringify(body));
    }

    for (const email of body.data ?? []) {
      if (email.subject !== subject || parseResendDate(email.created_at) < campaignSince) continue;
      for (const to of email.to ?? []) {
        const normalized = normalizeEmail(to);
        if (normalized) sentEmails.add(normalized);
      }
    }

    if (!body.has_more || !body.data?.length) break;
    after = body.data[body.data.length - 1]?.id ?? null;
    if (!after) break;
  }

  return sentEmails;
};

const buildEmail = (name: string) =>
  React.createElement(
    EmailLayout,
    {
      preview,
      children: React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Heading,
          { className: 'm-0 text-[24px] font-bold text-navy-900' },
          'Join the official PIDEC 1.0 WhatsApp group',
        ),
        React.createElement(Text, { className: 'mt-4 text-grey-800' }, `Hi ${name || 'there'},`),
        React.createElement(
          Text,
          { className: 'mt-3 text-grey-800' },
          "We've created an official WhatsApp group for PIDEC 1.0 participants.",
        ),
        React.createElement(
          Text,
          { className: 'mt-3 text-grey-800' },
          'Please join the group so you can receive important updates, deadline reminders, announcements, platform guidance, and quick support from the PIDEC team.',
        ),
        React.createElement(
          Section,
          { style: { marginTop: '28px', marginBottom: '22px' } },
          React.createElement(
            'a',
            {
              href: whatsappUrl,
              target: '_blank',
              style: {
                backgroundColor: '#2b0640',
                borderRadius: '8px',
                color: '#ffffff',
                display: 'inline-block',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: '20px',
                padding: '14px 24px',
                textDecoration: 'none',
              },
            },
            React.createElement(
              'span',
              { style: { color: '#ffffff', textDecoration: 'none' } },
              'Join the WhatsApp group',
            ),
          ),
        ),
        React.createElement(
          Text,
          { className: 'mt-4 text-grey-800' },
          'Or open this link: ',
          React.createElement(
            Link,
            { href: whatsappUrl, className: 'text-navy-800 underline' },
            whatsappUrl,
          ),
        ),
        React.createElement(
          Text,
          { className: 'mt-3 text-grey-800' },
          'This group is for all PIDEC 1.0 participants, whether you already have a team, are still teamless, have submitted, or are still completing your next steps.',
        ),
        React.createElement(Text, { className: 'mt-6 text-grey-800' }, 'Best regards,'),
        React.createElement(Text, { className: 'mt-0 text-grey-800' }, 'PIDEC 1.0 Team'),
      ),
    },
  );

const main = async () => {
  const { live } = parseArgs();

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required');
  }

  const recipients = await parseRecipientsFile();
  const alreadySent = await listAlreadySentCampaignEmails();
  const remaining = recipients.filter((recipient) => !alreadySent.has(recipient.email.toLowerCase()));

  if (!live || remaining.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: live ? 'live' : 'dry-run',
          recipientsFile,
          totals: {
            documentedRecipients: recipients.length,
            alreadySent: recipients.length - remaining.length,
            remaining: remaining.length,
            wouldSend: live ? 0 : remaining.length,
          },
          remainingRecipients: remaining.map((recipient) => ({
            name: recipient.name,
            email: recipient.email,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const payload: RawEmailPayload[] = [];
  for (const recipient of remaining) {
    const email = buildEmail(recipient.name);
    payload.push({
      from: process.env.RESEND_FROM_EMAIL ?? 'PIDEC 1.0 <competitions@pidec.com.ng>',
      to: [recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email],
      subject,
      html: await render(email),
      text: await render(email, { plainText: true }),
    });
  }

  const response = await fetchWithRetry('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'pidec-whatsapp-group-remaining-2026-05-29',
    },
    body: JSON.stringify(payload),
  });
  const rawBody = await response.text();

  if (!response.ok) {
    const brevoResult = await sendWithBrevoFallback(payload);
    if (brevoResult.sent === 0) {
      throw new Error(
        JSON.stringify({
          resend: { status: response.status, attempted: payload.length, body: rawBody },
          fallback: brevoResult,
        }),
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: 'live',
          recipientsFile,
          totals: {
            documentedRecipients: recipients.length,
            alreadySent: recipients.length - remaining.length,
            attempted: payload.length,
          },
          resendResponse: { status: response.status, body: rawBody },
          fallback: brevoResult,
        },
        null,
        2,
      ),
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: 'live',
        recipientsFile,
        totals: {
          documentedRecipients: recipients.length,
          alreadySent: recipients.length - remaining.length,
          attempted: payload.length,
        },
        resendResponse: JSON.parse(rawBody) as unknown,
      },
      null,
      2,
    ),
  );
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Remaining WhatsApp group email send failed:', err);
  process.exitCode = 1;
});
