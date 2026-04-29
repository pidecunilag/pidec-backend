import { type ReactNode } from 'react';

/**
 * Admin layout. Middleware (src/middleware.ts) handles auth + role gate
 * for everything under /admin/* except /admin/login. The full admin shell
 * with audit-log feed and admin nav arrives in Phase 5.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
