import { type ReactNode } from 'react';

/**
 * Judge layout. Middleware enforces role=judge. Full judge shell with
 * stage-scoped nav arrives in Phase 6.
 */
export default function JudgeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
