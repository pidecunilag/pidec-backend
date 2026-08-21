import { Button, Heading, Text } from '@react-email/components';
import type { FinaleReminderPayload } from '../../../domain/services/email-service.js';
import { EmailLayout } from './_layout.js';

const reminderCopy = {
  '3-days': {
    heading: '3 days to the PIDEC Grand Finale',
    intro: 'The countdown is on. The PIDEC 1.0 Grand Finale is just 3 days away.',
  },
  '2-days': {
    heading: '2 days to the PIDEC Grand Finale',
    intro: 'Only 2 days remain until the PIDEC 1.0 Grand Finale.',
  },
  '1-day': {
    heading: 'The PIDEC Grand Finale is tomorrow',
    intro: 'We are one day away from the PIDEC 1.0 Grand Finale. We look forward to seeing you.',
  },
  'event-day': {
    heading: "It's D-day",
    intro: 'The PIDEC 1.0 Grand Finale is happening today. See you at 9:00 AM.',
  },
} as const;

export const FinaleReminderEmail = ({
  recipientName,
  registrationNumber,
  eventDate,
  eventTime,
  eventVenue,
  finaleUrl,
  whatsappUrl,
  reminderType,
}: FinaleReminderPayload) => {
  const copy = reminderCopy[reminderType];

  return (
    <EmailLayout preview={copy.heading}>
      <Heading className="m-0 text-[24px] font-bold text-[#2b0640]">{copy.heading}</Heading>
      <Text className="mt-4 text-[#4d2b60]">
        Hi {recipientName}, {copy.intro}
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
        Keep your registration number handy for admission. Your registration is already confirmed.
      </Text>
      <Button
        href={finaleUrl}
        className="mt-5 inline-block rounded-md bg-[#2b0640] px-6 py-3 font-medium text-white no-underline"
      >
        View finale page
      </Button>
      <Text className="mt-5 text-[#4d2b60]">
        Get event updates in the <a href={whatsappUrl}>PIDEC Finale WhatsApp group</a>.
      </Text>
    </EmailLayout>
  );
};

export default FinaleReminderEmail;
