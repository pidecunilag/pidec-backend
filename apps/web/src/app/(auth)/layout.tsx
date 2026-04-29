import { Center } from '@mantine/core';
import { type ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center mih="100vh" p="md" style={{ background: 'var(--navy-50)' }}>
      {children}
    </Center>
  );
}
