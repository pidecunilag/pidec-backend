/**
 * Font loading via next/font/google. Both fonts are loaded with display:'swap'
 * for zero layout shift (per Design System §4.1).
 *
 * - Plus Jakarta Sans: weights 700, 800 — headings only
 * - DM Sans:           weights 400, 500, 600 — all body and UI text
 */
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
});

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-dm-sans',
});
