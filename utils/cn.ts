/**
 * Tiny classnames helper — joins truthy values with a space.
 * Kept dependency-free on purpose; swap for `clsx` + `tailwind-merge`
 * later if conditional class merging gets complex.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
