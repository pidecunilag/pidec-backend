import { Button, Heading, Text } from '@react-email/components';
import { EmailLayout } from './_layout.js';
import type { FinaleRegistrationConfirmedPayload } from '../../../domain/services/email-service.js';

export const FinaleRegistrationConfirmedEmail = ({
  recipientName,
  registrationNumber,
  eventDate,
  eventTime,
  eventVenue,
  finaleUrl,
  whatsappUrl,
}: FinaleRegistrationConfirmedPayload) => (
  <EmailLayout preview={`You're registered for the PIDEC 1.0 Grand Finale`}>
    <Heading className="m-0 text-[24px] font-bold text-[#2b0640]">
      You&apos;re registered for the Grand Finale
    </Heading>
    <Text className="mt-4 text-[#4d2b60]">
      Hi {recipientName}, your place at the PIDEC 1.0 Grand Finale is confirmed.
    </Text>
    <Text className="mt-3 text-[#4d2b60]">
      Registration number: <strong>{registrationNumber}</strong>
      <br />
      Date: <strong>{eventDate}</strong>
      <br />
      Time: <strong>{eventTime}</strong>
      <br />
      Venue: <strong>{eventVenue}</strong>
    </Text>
    <Text className="mt-3 text-[#4d2b60]">
      Keep your registration number handy for admission. You can also create and download your
      personalised “I&apos;m going” card now or return to the card page whenever you like.
    </Text>
    <Button
      href={finaleUrl}
      className="mt-5 inline-block rounded-md bg-[#2b0640] px-6 py-3 font-medium text-white no-underline"
    >
      Create your share card
    </Button>
    <Text className="mt-5 text-[#4d2b60]">
      Meet other attendees and get event updates in the PIDEC Finale WhatsApp group.
    </Text>
    <Button
      href={whatsappUrl}
      className="mt-2 inline-block rounded-md bg-[#167447] px-6 py-3 font-medium text-white no-underline"
    >
      Join the WhatsApp group
    </Button>
    <Text className="mt-3 break-all text-[13px] text-[#6f527d]">
      WhatsApp group link: <a href={whatsappUrl}>{whatsappUrl}</a>
    </Text>
  </EmailLayout>
);

export default FinaleRegistrationConfirmedEmail;
