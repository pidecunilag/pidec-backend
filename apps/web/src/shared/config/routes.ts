/**
 * Centralised route paths. Always reference via this constant — never
 * hardcode paths in components or links.
 */

export const ROUTES = {
  // Public
  HOME: '/',
  ABOUT: '/#about',
  STAGES: '/#stages',
  DEPARTMENTS: '/#departments',
  FAQ: '/#faq',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_PROCESSING: '/verify',

  // Student dashboard
  DASHBOARD: '/dashboard',
  TEAM: '/dashboard/team',
  TEAM_INVITES: '/dashboard/team/invites',
  SUBMISSIONS: '/dashboard/submissions',
  STAGE_1_FORM: '/dashboard/submissions/stage-1',
  STAGE_2_FORM: '/dashboard/submissions/stage-2',
  STAGE_3_FORM: '/dashboard/submissions/stage-3',
  NOTIFICATIONS: '/dashboard/notifications',

  // Admin
  ADMIN_LOGIN: '/admin/login',
  ADMIN_HOME: '/admin',
  ADMIN_VERIFICATIONS: '/admin/verifications',
  ADMIN_STUDENTS: '/admin/students',
  ADMIN_TEAMS: '/admin/teams',
  ADMIN_SUBMISSIONS: '/admin/submissions',
  ADMIN_TOKENS: '/admin/tokens',
  ADMIN_JUDGES: '/admin/judges',
  ADMIN_FEEDBACK: '/admin/feedback',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_CONTENT: '/admin/content',

  // Judge
  JUDGE_HOME: '/judge',
  JUDGE_SUBMISSIONS: '/judge/submissions',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
