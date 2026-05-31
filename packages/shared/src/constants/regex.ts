/**
 * Matric number rules per PRD §3.1:
 *   - Exactly 9 digits
 *   - YY (positions 0-1): 18–25  (admission year window for active students)
 *   - FF (positions 2-3): 04 or 08 (Engineering students may retain transferred faculty numbers)
 *   - DDXXX (positions 4-8): department + sequence (any 5 digits)
 *
 * The single regex captures all three rules:
 *   ^(?:18|19|2[0-5])(?:04|08)\d{5}$
 */
export const MATRIC_REGEX = /^(?:1[89]|2[0-5])(?:04|08)\d{5}$/;

/** Loose digit-only sanity check (DB-level constraint matches this). */
export const MATRIC_DIGITS_REGEX = /^\d{9}$/;

/**
 * Strip all separators (whitespace, slashes, hyphens, dots) before validating.
 * This matches the normalisation used during AI verification matric comparison.
 */
export const stripMatricSeparators = (raw: string): string =>
  raw.replace(/[\s/\-.]/g, '');

export const isValidMatricNumber = (raw: string): boolean =>
  MATRIC_REGEX.test(stripMatricSeparators(raw));

/**
 * Submission tokens — 12 alphanumeric characters (mixed case + digits).
 * Generated server-side via crypto.randomBytes; this is the format check.
 */
export const SUBMISSION_TOKEN_REGEX = /^[A-Za-z0-9]{12}$/;

/** Password rule per PRD §3.1: ≥ 8 chars, ≥ 1 letter, ≥ 1 number. */
export const PASSWORD_HAS_LETTER_REGEX = /[A-Za-z]/;
export const PASSWORD_HAS_NUMBER_REGEX = /\d/;
export const PASSWORD_MIN_LENGTH = 8;
