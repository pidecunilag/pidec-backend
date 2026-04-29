/**
 * Tiny classname helper. Joins truthy strings/objects without bringing in
 * `clsx` or `classnames` as a dependency.
 */
export const cn = (...args: Array<string | false | null | undefined | Record<string, boolean>>): string => {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      out.push(arg);
    } else {
      for (const [key, val] of Object.entries(arg)) {
        if (val) out.push(key);
      }
    }
  }
  return out.join(' ');
};
