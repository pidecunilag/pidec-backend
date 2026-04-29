'use client';

import { AppShell, Anchor, Button, Container, Group, Title } from '@mantine/core';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { ROUTES } from '@/shared/config/routes';

const NAV_LINKS = [
  { label: 'About', href: ROUTES.ABOUT },
  { label: 'Stages', href: ROUTES.STAGES },
  { label: 'Departments', href: ROUTES.DEPARTMENTS },
  { label: 'FAQ', href: ROUTES.FAQ },
];

export interface PublicShellProps {
  children: ReactNode;
  signupOpen?: boolean;
}

/** Landing-site shell. Full-width sections; inner Container constrains content. */
export const PublicShell = ({ children, signupOpen = false }: PublicShellProps) => {
  return (
    <AppShell padding={0} header={{ height: 72 }}>
      <AppShell.Header withBorder>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Anchor component={Link} href={ROUTES.HOME} underline="never">
              <Title order={3} c="navy.8">
                PIDEC 1.0
              </Title>
            </Anchor>
            <Group gap="md" visibleFrom="sm">
              {NAV_LINKS.map((l) => (
                <Anchor key={l.href} component={Link} href={l.href} c="dark" fw={500}>
                  {l.label}
                </Anchor>
              ))}
            </Group>
            <Group gap="sm">
              <Button component={Link} href={ROUTES.LOGIN} variant="subtle" color="navy.8">
                Sign in
              </Button>
              {signupOpen ? (
                <Button component={Link} href={ROUTES.REGISTER} color="gold.7" c="navy.9">
                  Register
                </Button>
              ) : null}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};
