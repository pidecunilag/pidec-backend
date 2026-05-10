import { Button, Heading, Hr, Section, Text } from '@react-email/components';
import { EmailLayout } from './_layout.js';
import type { JudgeInvitePayload } from '../../../domain/services/email-service.js';

export const JudgeInviteEmail = ({
  recipientName,
  stageLabel,
  departments,
  setupLink,
  expiresIn,
}: JudgeInvitePayload) => (
  <EmailLayout preview={`You have been invited to judge PIDEC ${stageLabel}`}>
    <Heading className="m-0 text-[28px] font-bold tracking-[-0.03em] text-[#2b0640]">
      Your PIDEC judging invitation
    </Heading>
    <Text className="mt-4 text-[#5f3f72]">Hi {recipientName},</Text>
    <Text className="mt-3 text-[#5f3f72]">
      You have been invited to serve as a PIDEC 1.0 judge for <strong>{stageLabel}</strong>.
      Your judging access has been prepared for the department scope below.
    </Text>

    <Section className="mt-6 rounded-[20px] border border-[#eadff0] bg-[#fbf7fe] p-5">
      <Text className="m-0 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff5a00]">
        Assigned department scope
      </Text>
      <Text className="m-0 mt-2 text-[18px] font-bold text-[#2b0640]">
        {departments.join(', ')}
      </Text>
      <Hr className="my-4 border-[#eadff0]" />
      <Text className="m-0 text-[14px] text-[#7b5a8d]">
        This invite link expires in <strong>{expiresIn}</strong>. Use it to set your password,
        confirm access, and continue straight to your judge dashboard.
      </Text>
    </Section>

    <Button
      href={setupLink}
      className="mt-6 inline-block rounded-full bg-[#2b0640] px-7 py-3 text-white font-bold no-underline"
    >
      Set password and open dashboard
    </Button>

    <Text className="mt-6 text-[13px] leading-[1.6] text-[#7b5a8d]">
      If the button does not work, copy this secure link into your browser:
    </Text>
    <Text className="mt-2 break-all rounded-[14px] bg-[#f8f4fb] p-3 text-[12px] text-[#5f3f72]">
      {setupLink}
    </Text>
  </EmailLayout>
);

export default JudgeInviteEmail;
