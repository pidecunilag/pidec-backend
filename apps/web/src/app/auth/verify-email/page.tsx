import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyEmailPage from './verify-email-page.js';

export const metadata: Metadata = {
  title: 'Email Verification | PIDEC',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPage />
    </Suspense>
  );
}
