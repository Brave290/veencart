import type { ComponentPropsWithoutRef } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/cn';
import {
  ariaInvalidProps,
  controlSurfaceClass,
  controlTypographyClass,
  type TextControlProps,
} from './form-field';

/**
 * SELECT
 * ------
 * A native `<select>`. The custom chevron is decorative and sits in a
 * `pointer-events-none` layer so the OS picker still opens from a tap anywhere
 * on the control — which on a phone is the difference between a usable
 * service-area picker and an infuriating one.
 *
 * `appearance-none` is only safe BECAUSE the chevron is drawn. Strip the
 * native arrow and supply nothing and the control becomes an unlabelled box
 * on desktop and an invisible one on iOS.
 *
 * A native select gets the platform's own picker, which is right for
 * "Lagos / Abuja / Port Harcourt" and for any list over ~15 items. For a long
 * searchable list, build a combobox — do not turn a 60-state select into a
 * custom widget and call that a design system decision.
 *
 * The chevron is positioned with `top-1/2 -translate-y-1/2` rather than
 * `inset-y-0` so it stays optically centred when the control grows to two
 * lines of text on a long option.
 */
export type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'size'> &
  TextControlProps;

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <div className="relative min-w-0">
      <select
        {...rest}
        {...ariaInvalidProps(invalid)}
        className={cn(
          controlSurfaceClass,
          controlTypographyClass,
          // `pr-9` reserves the chevron gutter so text never runs under it.
          'h-11 appearance-none pr-9 md:h-10',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-content-subtle"
      />
    </div>
  );
}
