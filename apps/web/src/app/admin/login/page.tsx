import type { Metadata } from 'next';
import AdminLoginForm from './form';

export const metadata: Metadata = {
  title: 'Admin Sign in',
  robots: { index: false, follow: false },
};

/**
 * Admin login lives outside the dashboard middleware guard so admins can
 * reach it before authenticating. Per PRD §8: "Accessible via /admin/login —
 * not linked from public site."
 */
export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
