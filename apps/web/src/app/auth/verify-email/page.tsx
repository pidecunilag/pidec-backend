import type { Metadata } from 'next';
import VerifyEmailPage from './verify-email-page.js';

export const metadata: Metadata = {
  title: 'Email Verification | PIDEC',
};

export default function Page() {
  return <VerifyEmailPage />;
}
