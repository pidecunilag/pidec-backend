import { Button, Heading, Link, Text } from '@react-email/components';
import { EmailLayout } from './_layout.js';

export interface Stage1SubmissionReminderPayload {
  recipientName: string;
  teamName: string;
}

const submissionsUrl = 'https://pidec.com.ng/dashboard/submissions';

export const Stage1SubmissionReminderEmail = ({
  recipientName,
  teamName,
}: Stage1SubmissionReminderPayload) => (
  <EmailLayout preview="Stage 1 submission deadline reminder">
    <Heading className="m-0 text-[24px] font-bold text-navy-900">
      Reminder: Stage 1 submission deadline is May 31
    </Heading>

    <Text className="mt-4 text-grey-800">Hi {recipientName},</Text>
    <Text className="mt-3 text-grey-800">
      This is a reminder that the PIDEC 1.0 submission deadline for Stage 1 is Sunday, May 31,
      2026.
    </Text>
    <Text className="mt-3 text-grey-800">
      Please ensure your team, <strong>{teamName}</strong>, uploads and submits the required
      proposal document before the deadline. Only team leads can complete the final submission,
      so we recommend submitting early to avoid last minute issues.
    </Text>
    <Text className="mt-3 text-grey-800">
      Once submitted, your entry will be accepted and moved forward for review.
    </Text>

    <Button
      href={submissionsUrl}
      className="mt-6 inline-block rounded-md bg-navy-800 px-6 py-3 text-white font-medium no-underline"
    >
      Submit here
    </Button>

    <Text className="mt-4 text-grey-800">
      <Link href={submissionsUrl} className="text-navy-800 underline">
        {submissionsUrl}
      </Link>
    </Text>

    <Text className="mt-6 text-grey-800">Best regards,</Text>
    <Text className="mt-0 text-grey-800">PIDEC 1.0 Team</Text>
  </EmailLayout>
);

export default Stage1SubmissionReminderEmail;
