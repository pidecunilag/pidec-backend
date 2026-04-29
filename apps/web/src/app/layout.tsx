import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import type { Metadata, Viewport } from 'next';
import { type ReactNode } from 'react';
import { dmSans, plusJakartaSans } from './fonts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PIDEC 1.0 — Prototype Inter-Departmental Engineering Challenge',
    template: '%s · PIDEC 1.0',
  },
  description:
    'PIDEC 1.0 — the official competition platform for the Prototype Inter-Departmental Engineering Challenge, hosted by the University of Lagos Engineering Society.',
  applicationName: 'PIDEC 1.0',
  authors: [{ name: 'ULES Competitions & Technical Team' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#002868',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className={`${plusJakartaSans.variable} ${dmSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
