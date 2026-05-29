import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { type ReactNode } from 'react';
import { env } from '../../../shared/config/env.js';

const fallbackAppUrl = 'https://pidec.com.ng';
const resolvedAppUrl =
  env.APP_URL && !/localhost|127\.0\.0\.1|\[::1\]/i.test(env.APP_URL) ? env.APP_URL : fallbackAppUrl;

const appUrl = resolvedAppUrl.replace(/\/$/, '');
const logoLightUrl = 'https://pidec.com.ng/logos/Coloured%20Logo%20Black%20text%20Trans.png';
const logoDarkUrl = 'https://pidec.com.ng/logos/Coloured%20Logo%20White%20text%20Trans.png';

export interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export const EmailLayout = ({ preview, children }: EmailLayoutProps) => (
  <Html>
    <Head>
      <style>
        {`
          .pidec-logo-dark { display: none !important; }
          @media (prefers-color-scheme: dark) {
            .pidec-logo-light { display: none !important; }
            .pidec-logo-dark { display: block !important; }
          }
        `}
      </style>
    </Head>
    <Preview>{preview}</Preview>
    <Tailwind>
      <Body className="m-0 bg-[#f8f4fb] p-0 font-sans text-[16px] leading-[1.65] text-[#2b0640]">
        <Container className="mx-auto max-w-[600px] px-6 py-10">
          <Section className="rounded-[28px] border border-[#eadff0] bg-white px-8 py-6 shadow-sm">
            <Img
              src={logoLightUrl}
              width="154"
              height="44"
              alt="PIDEC 1.0"
              className="pidec-logo-light"
            />
            <Img
              src={logoDarkUrl}
              width="154"
              height="44"
              alt="PIDEC 1.0"
              className="pidec-logo-dark"
            />
          </Section>

          <Section className="mt-5 rounded-[28px] border border-[#eadff0] bg-white p-8 shadow-sm">
            {children}
          </Section>

          <Hr className="my-8 border-[#eadff0]" />
          <Section>
            <Text className="m-0 text-[12px] leading-[1.6] text-[#7b5a8d]">
              You're receiving this because you registered for PIDEC 1.0, the Prototype Inter
              Departmental Engineering Challenge. Questions? Reply to this email.
            </Text>
            <Text className="mb-0 mt-3 text-[12px] text-[#7b5a8d]">
              (c) 2026 PIDEC. Visit{' '}
              <Link href={appUrl} className="text-[#2b0640]">
                {appUrl}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
