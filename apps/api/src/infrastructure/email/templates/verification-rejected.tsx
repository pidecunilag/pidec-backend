import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from './_layout.js';
import type { VerificationRejectedPayload } from '../../../domain/services/email-service.js';

export const VerificationRejectedEmail = ({
  recipientName,
  reason,
  attemptNumber,
  attemptsRemaining,
  reuploadUrl,
}: VerificationRejectedPayload) => (
  <EmailLayout preview="Verification unsuccessful — re-upload required">
    <Heading className="m-0 text-[24px] font-bold text-navy-900">
      Verification unsuccessful
    </Heading>
    <Text className="mt-4 text-grey-800">
      Hi {recipientName}, we couldn't verify your document automatically. Reason:
    </Text>
    <Text className="mt-2 rounded-md bg-grey-200/40 px-4 py-3 text-grey-800 italic">
      {reason}
    </Text>
    <Text className="mt-4 text-grey-800">
      This was attempt <strong>{attemptNumber}</strong>. You have{' '}
      <strong>{attemptsRemaining}</strong> re-upload attempt
      {attemptsRemaining === 1 ? '' : 's'} remaining. There's a 3-minute cool-down between
      attempts.
    </Text>
    <Button
      href={reuploadUrl}
      className="mt-6 inline-block rounded-md bg-navy-800 px-6 py-3 text-white font-medium no-underline"
    >
      Re-upload document
    </Button>
    <Text className="mt-6 text-grey-600 text-[14px]">
      Make sure your full name and matric number are clearly visible and the file is a clean,
      high-resolution scan.
    </Text>
  </EmailLayout>
);

export default VerificationRejectedEmail;
