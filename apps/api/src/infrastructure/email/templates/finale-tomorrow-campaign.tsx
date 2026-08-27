import { Button, Heading, Img, Section, Text } from '@react-email/components';
import type { FinaleTomorrowCampaignPayload } from '../../../domain/services/email-service.js';
import { EmailLayout } from './_layout.js';

const artworkBaseUrl =
  'https://hypsayvsrtzlkhzfqexe.supabase.co/storage/v1/object/public/public-assets/finale-email';

const Artwork = ({ src, alt }: { src: string; alt: string }) => (
  <Img
    src={`${artworkBaseUrl}/${src}`}
    width="536"
    alt={alt}
    className="my-6 h-auto w-full rounded-md"
  />
);

export const FinaleTomorrowCampaignEmail = ({
  recipientName,
  finaleUrl,
  whatsappUrl,
}: FinaleTomorrowCampaignPayload) => (
  <EmailLayout preview="Final pitches, ₦200,000 in giveaways, Huawei opportunities and more await you today.">
    <Artwork src="grand-finale.jpg" alt="PIDEC 1.0 Grand Finale" />

    <Text className="mt-0 text-[#4d2b60]">Hi {recipientName},</Text>
    <Heading className="m-0 text-[25px] font-bold leading-[1.3] text-[#2b0640]">
      Today: witness PIDEC 1.0's final pitches
    </Heading>
    <Text className="mt-4 text-[#4d2b60]">
      Today, the <strong>PIDEC 1.0 finalist teams</strong> take the stage to pitch the
      engineering solutions they have developed to create meaningful, sustainable impact.
    </Text>
    <Text className="mt-3 text-[#4d2b60]">
      After weeks of building and refining their ideas, the competition comes down to this: the{' '}
      <strong>PIDEC 1.0 Grand Finale</strong>.
    </Text>
    <Text className="mt-3 text-[#4d2b60]">
      Come and witness the final presentations, support the teams and see which solution emerges
      as the winner.
    </Text>

    <Heading as="h2" className="mb-0 mt-7 text-[20px] font-bold text-[#2b0640]">
      Arrive early
    </Heading>
    <Text className="mt-2 text-[#4d2b60]">
      Registration and admission begin at <strong>8:00 AM</strong> at the{' '}
      <strong>J.F. Ajayi Auditorium, University of Lagos</strong>. The latest arrival time is{' '}
      <strong>8:45 AM</strong> because:
    </Text>
    <Text className="ml-3 mt-2 text-[#4d2b60]">
      &bull; Breakfast will be served to attendees present at 8:45 AM.
      <br />
      &bull; Only attendees present at <strong>8:45 AM</strong> will qualify for giveaways worth a
      total of <strong>₦200,000</strong>.
      <br />
      &bull; You will have the opportunity to compete for <strong>two Huawei internship slots</strong>.
      <br />
      &bull; You can settle in before the finalist pitches and programme begin.
    </Text>
    <Text className="mt-3 text-[#4d2b60]">
      Simply provide your <strong>name or registered email address</strong> at the admission desk.
    </Text>

    <Heading as="h2" className="mb-0 mt-7 text-[20px] font-bold text-[#2b0640]">
      Meet our keynote speaker
    </Heading>
    <Artwork src="keynote-speaker.jpg" alt="PIDEC 1.0 keynote speaker" />
    <Text className="mt-0 text-[#4d2b60]">
      We are honoured to welcome <strong>Barr. 'Bimbola Salu-Hundeyin, FICMC, MCArb</strong>,
      Secretary to the Lagos State Government, as the keynote speaker at the PIDEC 1.0 Grand
      Finale.
    </Text>

    <Heading as="h2" className="mb-0 mt-7 text-[20px] font-bold text-[#2b0640]">
      Meet our panellist
    </Heading>
    <Artwork src="technical-ben.jpg" alt="Technical Ben, PIDEC 1.0 panellist" />
    <Text className="mt-0 text-[#4d2b60]">
      The PIDEC 1.0 Grand Finale will also feature <strong>Technical Ben</strong>, lifecycle email
      marketer and founder, as a panellist.
    </Text>

    <Section className="mt-7 rounded-md bg-[#f8f4fb] px-5 py-4">
      <Text className="m-0 text-[#4d2b60]">
        <strong>Date:</strong> Friday, 28 August 2026
        <br />
        <strong>Admission opens:</strong> 8:00 AM
        <br />
        <strong>Latest arrival:</strong> 8:45 AM
        <br />
        <strong>Programme begins:</strong> 9:00 AM
        <br />
        <strong>Venue:</strong> J.F. Ajayi Auditorium, University of Lagos
      </Text>
    </Section>

    <Button
      href={finaleUrl}
      className="mt-6 inline-block rounded-md bg-[#2b0640] px-6 py-3 font-medium text-white no-underline"
    >
      View PIDEC 1.0 Grand Finale details
    </Button>
    <br />
    <Button
      href={whatsappUrl}
      className="mt-3 inline-block rounded-md bg-[#167447] px-6 py-3 font-medium text-white no-underline"
    >
      Join the PIDEC 1.0 WhatsApp group
    </Button>

    <Text className="mt-6 text-[#4d2b60]">
      Come early. Watch the ideas come alive. Connect, learn and stand a chance to win.
    </Text>
    <Text className="mb-0 mt-5 text-[#4d2b60]">
      See you today,
      <br />
      <strong>Faisal Adams</strong>
      <br />
      <strong>PIDEC 1.0 Chairperson</strong>
    </Text>
  </EmailLayout>
);

export default FinaleTomorrowCampaignEmail;
