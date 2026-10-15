import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names.
 *
 * Two things are happening here and both are load-bearing:
 *
 * 1. `clsx` flattens conditionals, arrays and objects into a single string.
 *    `cn('a', cond && 'b', { c: true })` -> `'a b c'`
 *
 * 2. `twMerge` resolves Tailwind *conflicts* and keeps the last one, so a
 *    caller's `className` can override a component's baked-in default:
 *
 *    <Button className="px-8" />        // base has px-4 -> result is px-8
 *    <Button className="rounded-full"/> // base has rounded-md -> rounded-full
 *
 * Without step 2 a consumer could not style these primitives at all without
 * `!important` hacks, and every override would be a specificity fight.
 *
 * The `undefined` guard is for the common `cn(undefined, isActive && 'x')`
 * pattern — twMerge treats a non-string input as a class group and can produce
 * surprising output, so normalise to string first.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
