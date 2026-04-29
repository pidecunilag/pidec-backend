'use client';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { type ReactNode } from 'react';
import { pidecTheme } from '@/shared/config/theme';

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <MantineProvider theme={pidecTheme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" zIndex={9999} />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
};
