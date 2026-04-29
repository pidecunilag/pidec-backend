'use client';

import { AppShell, Burger, Group, NavLink, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBell,
  IconClipboardList,
  IconHome,
  IconUsersGroup,
  type IconProps,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, type ReactNode } from 'react';
import { ROUTES } from '@/shared/config/routes';

interface NavEntry {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
}

const STUDENT_NAV: NavEntry[] = [
  { label: 'Overview',      href: ROUTES.DASHBOARD,     icon: IconHome },
  { label: 'My Team',       href: ROUTES.TEAM,          icon: IconUsersGroup },
  { label: 'Submissions',   href: ROUTES.SUBMISSIONS,   icon: IconClipboardList },
  { label: 'Notifications', href: ROUTES.NOTIFICATIONS, icon: IconBell },
];

export interface DashboardShellProps {
  children: ReactNode;
  user: { name: string; teamName?: string | null; role?: 'student' | 'admin' | 'judge' };
  navItems?: NavEntry[];
  logoText?: string;
}

/**
 * Dashboard layout shell. 240px fixed sidebar + fluid content area
 * (Design System §6, "Layout Rules" point 2). Sidebar collapses to a
 * Drawer/Burger on screens below `md` breakpoint.
 */
export const DashboardShell = ({
  children,
  user,
  navItems = STUDENT_NAV,
  logoText = 'PIDEC 1.0',
}: DashboardShellProps) => {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();

  return (
    <AppShell
      padding="md"
      header={{ height: 64 }}
      navbar={{
        width: 240,
        breakpoint: 'md',
        collapsed: { mobile: !opened },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label="Toggle navigation" />
            <Title order={3} c="navy.8">
              {logoText}
            </Title>
          </Group>
          <Stack gap={0} ta="right">
            <Text size="sm" fw={500}>{user.name}</Text>
            {user.teamName ? (
              <Text size="xs" c="dimmed">
                {user.teamName}
              </Text>
            ) : null}
          </Stack>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea>
          <Stack gap={4}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  leftSection={<Icon size={20} aria-hidden="true" />}
                  active={isActive}
                  variant="filled"
                  color="navy.8"
                />
              );
            })}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};
