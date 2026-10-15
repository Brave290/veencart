import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * LABEL
 * -----
 * A real `<label>`. `htmlFor` is required whenever the label does not WRAP
 * its control — that is the only way a screen reader pairs the two, and
 * clicking the label focuses the field, which on mobile is a real precision
 * win. When a control is wrapped (see `Checkbox` / `Radio`) `htmlFor` must be
 * omitted, because a `for` pointing at a nested control double-associates it
 * in some AT.
 *
 * The `required` asterisk is decorative: it is `aria-hidden` and the actual
 * requirement is announced from the control's own `required` attribute. Two
 * sources for one fact is how a screen reader ends up saying "required" twice.
 */
export type LabelProps = ComponentProps<'label'> & {
  /** Renders the decorative required marker. The control still needs `required`. */
  required?: boolean;
  /** Optional note rendered after the label text, e.g. "(optional)". */
  optionalText?: ReactNode;
};

export function Label({
  className,
  required = false,
  optionalText,
  children,
  ...rest
}: LabelProps) {
  return (
    <label
      {...rest}
      className={cn('inline-flex items-baseline gap-1.5 text-sm font-medium text-content', className)}
    >
      <span>{children}</span>
      {required ? (
        <span aria-hidden="true" className="font-semibold text-danger-text">
          *
        </span>
      ) : null}
      {optionalText ? (
        <span className="text-xs font-normal text-content-subtle">{optionalText}</span>
      ) : null}
    </label>
  );
}
