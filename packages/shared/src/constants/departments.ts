/**
 * The 10 departments of the UNILAG Faculty of Engineering.
 *
 * NOTE: This list is the source of truth across both web and api. If the
 * Competitions team confirms a different official list, update only this
 * file and recompile — every Zod schema, dropdown, and validation pulls
 * from here.
 */
export const DEPARTMENTS = [
  'Biomedical Engineering',
  'Chemical Engineering',
  'Civil and Environmental Engineering',
  'Computer Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Metallurgical and Materials Engineering',
  'Petroleum and Gas Engineering',
  'Surveying and Geoinformatics Engineering',
  'Systems Engineering',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const isDepartment = (value: unknown): value is Department =>
  typeof value === 'string' && (DEPARTMENTS as readonly string[]).includes(value);
