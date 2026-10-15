import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

import { cn } from '../../lib/cn';

/* ========================================================================== */
/* SHARED FORM PRIMITIVES                                                     */
/*                                                                            */
/* Input, Textarea and Select all render the same rectangle. The recipe lives  */
/* here, once, so a search box can never end up 2px shorter than the select   */
/* next to it — the most common way a competent UI still looks amateur.       */
/* ========================================================================== */

export const controlSurfaceClass = [
  // `min-w-0` is not optional. A flex or grid child defaults to
  // `min-width: auto`, which lets a long placeholder push the layout past the
  // viewport. At 320px this is the top cause of horizontal overflow in forms.
  'w-full min-w-0 rounded-sm border bg-surface px-3',
  'text-base text-content placeholder:text-content-subtle',
  'border-line-strong',
  'transition-colors duration-fast ease-out',
  // `focus:`, not `focus-visible:` — a text field should look active the
  // moment it is tapped. The global `:focus-visible` outline in globals.css
  // still paints the keyboard ring on top, so keyboard users get the stronger
  // indicator and pointer users get the right affordance.
  'focus:border-primary',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-content-disabled disabled:placeholder:text-content-disabled',
  'aria-[invalid=true]:border-danger-text aria-[invalid=true]:focus:border-danger-text',
].join(' ');

/**
 * 16px on mobile, always. iOS Safari zooms the viewport in when a focused
 * input computes below 16px and never zooms back out, stranding the user on a
 * magnified page. The `md:text-sm` step down is desktop-only.
 */
export const controlTypographyClass = 'text-base md:text-sm';

/** Shared invalid-state props, so the wiring cannot drift between controls. */
export function ariaInvalidProps(invalid: boolean | undefined) {
  return invalid ? ({ 'aria-invalid': true } as const) : {};
}

export type TextControlProps = {
  /**
   * Switches the control to its error styling and sets `aria-invalid`.
   * `FormField` sets this for you.
   */
  invalid?: boolean;
};

/** The props `FormField` injects into its child control. */
type FieldControlInjectedProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: true;
};

/* ========================================================================== */
/* FORM FIELD                                                                 */
/* ========================================================================== */

/**
 * FORM FIELD
 * ----------
 * Owns the entire label / hint / error / control relationship for one field.
 *
 * WHY IT INJECTS RATHER THAN ASKING FOR IDS
 * The usual alternative is `<FormField id="email">` plus `<Input id="email">`
 * — the same id typed twice, with nothing stopping the two from drifting. A
 * render prop would fix that, but a function prop cannot cross the
 * Server/Client boundary, which would force every form in the app into a
 * client bundle. So `FormField` injects the wiring into its single child with
 * `cloneElement`, which is pure and works inside a Server Component.
 *
 * It takes EXACTLY ONE element child. A wrapper that accepts arbitrary
 * children cannot guarantee the thing it labelled is the thing it described,
 * and the `aria-describedby` it emitted would then point at nothing.
 *
 * DESCRIPTION ORDER
 * `aria-describedby` is read in the order given. The description should read
 * "hint first, then what went wrong" — the hint explains the field, the error
 * says how to fix it, and that sequence only survives if the ids are
 * assembled in this exact order.
 */
export type FormFieldProps = {
  /** Stable id for the control. Required: it is the label/control join. */
  id: string;
  label: ReactNode;
  /** Helper copy under the control, referenced by `aria-describedby`. */
  hint?: ReactNode;
  /** Error copy. Its presence switches the control to `aria-invalid`. */
  error?: ReactNode;
  required?: boolean;
  optionalText?: ReactNode;
  className?: string;
  children: ReactElement;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  optionalText,
  className,
  children,
}: FormFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  // Only inject when the child actually looks like a form control. Anything
  // else (a fragment, a string, a custom widget) is rendered untouched rather
  // than crashed on, but the field still shows its label and messages.
  const control =
    isValidElement(children) && typeof children.type !== 'string'
      ? cloneElement(
          children as ReactElement<Partial<FieldControlInjectedProps>>,
          {
            id,
            ...(describedBy ? { 'aria-describedby': describedBy } : {}),
            ...(error ? { 'aria-invalid': true } : {}),
            ...(required ? { required: true } : {}),
          },
        )
      : children;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="inline-flex items-baseline gap-1.5 text-sm font-medium text-content"
      >
        <span>{label}</span>
        {required ? (
          // Decorative only. The control's own `required` attribute is what a
          // screen reader announces; two sources for one fact reads twice.
          <span aria-hidden="true" className="font-semibold text-danger-text">
            *
          </span>
        ) : null}
        {optionalText ? (
          <span className="text-xs font-normal text-content-subtle">{optionalText}</span>
        ) : null}
      </label>

      {control}

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-content-subtle">
          {hint}
        </p>
      ) : null}

      {error ? (
        // `role="alert"` so the message is announced the instant it appears.
        // Server-rendered validation is otherwise invisible: the user is
        // already looking at the field, and focus never moves to the text.
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-danger-text"
        >
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
