import { Heading, Link, Section, Text } from '@react-email/components';
import { EmailLayout } from './_layout.js';

export interface Stage1SubmissionReminderPayload {
  recipientName: string;
  teamName: string;
  daysLeft: number;
  deadlineLabel: string;
}

const submissionsUrl = 'https://pidec.com.ng/dashboard/submissions';

export const Stage1SubmissionReminderEmail = ({
  recipientName,
  teamName,
  daysLeft,
  deadlineLabel,
}: Stage1SubmissionReminderPayload) => (
  <EmailLayout preview={`Stage 1 submissions close on ${deadlineLabel}.`}>
    <Heading className="m-0 text-[24px] font-bold text-navy-900">
      {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left to submit your Stage 1 proposal
    </Heading>

    <Text className="mt-4 text-grey-800">Hi {recipientName},</Text>
    <Text className="mt-3 text-grey-800">
      There {daysLeft === 1 ? 'is' : 'are'} only <strong>{daysLeft}</strong>{' '}
      {daysLeft === 1 ? 'day' : 'days'} left to submit your PIDEC 1.0 Stage 1 proposal.
    </Text>
    <Text className="mt-3 text-grey-800">
      The Stage 1 submission deadline is <strong>{deadlineLabel}</strong>. Please ensure your team,{' '}
      <strong>{teamName}</strong>, uploads and submits the required proposal document before the
      deadline.
    </Text>
    <Text className="mt-3 text-grey-800">
      Only team leads can complete the final submission, so we strongly recommend submitting early
      to avoid last-minute issues.
    </Text>
    <Text className="mt-3 text-grey-800">
      Once submitted, your entry will be accepted and moved forward for review.
    </Text>

    <Section style={{ marginTop: '28px', marginBottom: '22px' }}>
      <a
        href={submissionsUrl}
        target="_blank"
        style={{
          backgroundColor: '#2b0640',
          borderRadius: '8px',
          color: '#ffffff',
          display: 'inline-block',
          fontSize: '16px',
          fontWeight: 700,
          lineHeight: '20px',
          padding: '14px 24px',
          textDecoration: 'none',
        }}
      >
        <span style={{ color: '#ffffff', textDecoration: 'none' }}>Submit here</span>
      </a>
    </Section>

    <Text className="mt-4 text-grey-800">
      Or open this link:{' '}
      <Link href={submissionsUrl} className="text-navy-800 underline">
        {submissionsUrl}
      </Link>
    </Text>

    <Text className="mt-6 text-grey-800">Best regards,</Text>
    <Text className="mt-0 text-grey-800">PIDEC 1.0 Team</Text>
  </EmailLayout>
);

export default Stage1SubmissionReminderEmail;
