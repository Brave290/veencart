import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../../lib/cn';
import {
  ariaInvalidProps,
  controlSurfaceClass,
  controlTypographyClass,
  type TextControlProps,
} from './form-field';

/**
 * TEXTAREA
 * --------
 * Native `<textarea>`, `resize-y` only. Horizontal resize on a form field is
 * a layout bug waiting to happen — it lets a user drag a field past the
 * viewport edge and there is no way to know what they did.
 *
 * `min-h-24` rather than `rows`: `rows` collapses to a single line on a
 * narrow phone when a field has to grow with its content, and a shipping
 * address box that is 20px tall at 320px is useless.
 */
export type TextareaProps = ComponentPropsWithoutRef<'textarea'> & TextControlProps;

export function Textarea({ className, invalid, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      {...rest}
      {...ariaInvalidProps(invalid)}
      className={cn(
        controlSurfaceClass,
        controlTypographyClass,
        'min-h-24 resize-y py-2.5 leading-relaxed',
        className,
      )}
    />
  );
}
