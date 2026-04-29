/**
 * PIDEC 1.0 — Mantine theme.
 *
 * Encodes the design system v1.0 (Section 3 colour tokens, Section 4 type
 * scale, Section 5 spacing, Section 6 breakpoints, Section 7.1 global theme
 * config). Single source of truth — every component pulls from here.
 *
 * Mantine colour arrays follow the convention [50, 100, 200, ..., 900].
 * Index 8 is the "primary shade" in light mode (per Section 7.1).
 */

import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Navy — derived from #002868 (UNILAG Faculty of Engineering navy)
const navy: MantineColorsTuple = [
  '#F0F3F9', // 0  — navy-50
  '#E8EDF5', // 1  — navy-100
  '#C9D5E8', // 2
  '#9FB1D2', // 3
  '#6F88B7', // 4
  '#4A6699', // 5
  '#2D4A82', // 6
  '#1A3F7A', // 7  — navy-700
  '#002868', // 8  — navy-800 ✦ base brand
  '#001540', // 9  — navy-900
];

// Gold — derived from #C9A84C
const gold: MantineColorsTuple = [
  '#FBF6E3', // 0
  '#F5E6B8', // 1  — gold-50
  '#EFD896', // 2
  '#E8CC84', // 3  — gold-300
  '#DCBA68', // 4
  '#D4AC56', // 5
  '#C9A84C', // 6  — gold-700 (slightly darker than 5 by hue)
  '#C9A84C', // 7  — gold-700 ✦ base brand (Mantine consumes index 6 for filled)
  '#A88838', // 8
  '#8A6A1E', // 9  — gold-900
];

export const pidecTheme = createTheme({
  primaryColor: 'navy',
  primaryShade: { light: 8, dark: 7 },
  defaultRadius: 'md', // 8px
  fontFamily: 'var(--font-dm-sans), system-ui, -apple-system, sans-serif',
  headings: {
    fontFamily: 'var(--font-plus-jakarta-sans), system-ui, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2.25rem', lineHeight: '1.15', fontWeight: '700' },
      h2: { fontSize: '1.75rem', lineHeight: '1.2', fontWeight: '700' },
      h3: { fontSize: '1.375rem', lineHeight: '1.25', fontWeight: '700' },
      h4: { fontSize: '1.125rem', lineHeight: '1.3', fontWeight: '600' },
      h5: { fontSize: '1rem', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '0.875rem', lineHeight: '1.5', fontWeight: '600' },
    },
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  breakpoints: {
    xs: '36em', // 576px
    sm: '48em', // 768px
    md: '62em', // 992px
    lg: '75em', // 1200px
    xl: '88em', // 1408px
  },
  colors: {
    navy,
    gold,
  },
  white: '#FFFFFF',
  black: '#1A1A2E',
  cursorType: 'pointer',
  focusRing: 'auto',
  // Default loader for all <Loader /> usages
  defaultGradient: { from: 'navy.8', to: 'navy.9', deg: 135 },
  // Component-level defaults
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: { fontWeight: 500 },
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        size: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        size: 'md',
        autosize: true,
      },
    },
    Select: {
      defaultProps: {
        size: 'md',
        searchable: true,
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        radius: 'md',
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
        padding: 'lg',
      },
    },
    Loader: {
      defaultProps: {
        color: 'navy.8',
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
        radius: 'sm',
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
    Stepper: {
      defaultProps: {
        color: 'navy.8',
        size: 'md',
      },
    },
    Tabs: {
      defaultProps: {
        variant: 'outline',
        color: 'navy.8',
      },
    },
  },
});
