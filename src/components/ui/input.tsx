import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../../lib/cn';
import {
  ariaInvalidProps,
  controlSurfaceClass,
  controlTypographyClass,
  type TextControlProps,
} from './form-field';

/**
 * INPUT
 * -----
 * A native `<input>` with no abstraction over `type`. A phone field must stay
 * `type="tel"`, a one-time-code field must keep `inputMode="numeric"`, a date
 * field must keep its native picker, and a pin field must keep
 * `inputMode="numeric"`. That is why this is a pass-through, not a wrapper
 * that invents a `PhoneInput`.
 *
 * HEIGHT
 * 44px, no small variant. A 32px input cannot be hit reliably on the
 * low-end Android handsets this product is used on. Density is bought with
 * layout — tighter field grouping — not with an unusable target.
 *
 * `size` is omitted from the native props on purpose: Tailwind's `size-*` and
 * the native `size` attribute mean completely different things, and a prop
 * that silently changes width depending on which one you meant is a trap.
 */
export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> &
  TextControlProps;

export function Input({ className, invalid, type = 'text', ...rest }: InputProps) {
  return (
    <input
      type={type}
      {...rest}
      {...ariaInvalidProps(invalid)}
      className={cn(controlSurfaceClass, controlTypographyClass, 'h-11 md:h-10', className)}
    />
  );
}
