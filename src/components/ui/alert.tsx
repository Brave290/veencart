import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * ALERT
 * -----
 * A persistent, inline message about the state of the thing the user is
 * looking at. Not a toast, and not a modal — both of those interrupt, and an
 * interruption is the wrong tool for "your payment is still pending".
 *
 * WHY `role="alert"` AND `role="status"` ARE NOT INTERCHANGEABLE
 * They are two different live-region politeness levels, and the choice is the
 * whole reason this component has a variant table:
 *
 *   role="alert"    -> aria-live="assertive". The live region INTERRUPTS
 *                      whatever the screen reader is currently saying. Correct
 *                      for `danger`: a failed payment or a rejected quote must
 *                      be heard now, because the user is about to act as if it
 *                      succeeded.
 *   role="status"   -> aria-live="polite". Queued until the current utterance
 *                      finishes. Correct for info / success / warning: they
 *                      inform, they do not demand.
 *
 * Using "alert" for a success message trains users to ignore alerts, which
 * then costs us the one moment a real error needed to be heard. Using "status"
 * for a failure means it waits politely behind whatever else is queued.
 *
 * COLOUR IS NEVER THE ONLY CHANNEL (WCAG 1.4.1)
 * Every variant ships an icon AND, unless the caller opts out, a screen-reader
 * visible prefix naming the severity ("Error: …"). A body-only alert reading
 * "We could not verify that payment." is understood by a sighted user from
 * the red tint and the icon; without the sr-only prefix a screen-reader user
 * hears the same words as a neutral update. The prefix closes that gap.
 */

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const ICON: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

/**
 * Severity wording read out before the message. Deliberately different words,
 * not just different casing: "Error" and "Information" are what a Nigerian
 * dispatcher or a customer would actually say.
 */
const SR_PREFIX: Record<AlertVariant, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

/**
 * `danger` interrupts; everything else queues. See the block comment above.
 * `aria-live` is written out explicitly rather than left to the implicit role
 * value — some older AT pairings only honour an explicit `aria-live`.
 */
const LIVE: Record<AlertVariant, 'assertive' | 'polite'> = {
  info: 'polite',
  success: 'polite',
  warning: 'polite',
  danger: 'assertive',
};

const ROLE: Record<AlertVariant, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  danger: 'alert',
};

/**
 * Surfaces come from the measured status tokens. Each pairs a tint with a text
 * colour that clears 4.5:1 ON THAT TINT (info 6.51:1, success 9.27:1,
 * warning 6.35:1, danger 8.65:1). Do not substitute a lighter border and
 * assume it still passes — the tint is doing the work here, not the border.
 */
const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: 'bg-info-surface border-info-border text-info-text',
  success: 'bg-success-surface border-success-border text-success-text',
  warning: 'bg-warning-surface border-warning-border text-warning-text',
  danger: 'bg-danger-subtle border-danger-strong/30 text-danger-text',
};

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  /** Rendered at the start of the message, `aria-hidden`. */
  icon?: LucideIcon;
  /** Pass `false` to drop the glyph. Never do this on a `danger` alert. */
  showIcon?: boolean;
  /**
   * Prefix the content with a screen-reader-only severity word. Default true.
   * Turn it off only when the title already says "Error" in plain language.
   */
  announceSeverity?: boolean;
};

export function Alert({
  variant = 'info',
  icon,
  showIcon = true,
  announceSeverity = true,
  className,
  children,
  ...rest
}: AlertProps) {
  const IconComponent = icon ?? ICON[variant];

  return (
    <div
      {...rest}
      role={ROLE[variant]}
      aria-live={LIVE[variant]}
      className={cn(
        'flex gap-3 rounded-md border p-4',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {showIcon && IconComponent ? (
        <IconComponent aria-hidden="true" className="mt-px size-5 shrink-0" />
      ) : null}
      {/* `min-w-0` so a long unbroken reference (VC-8471-XXXX) wraps instead of
          forcing the flex row wider than the viewport. */}
      <div className="min-w-0 flex-1 text-sm">
        {announceSeverity ? (
          // First thing inside the live region, so it is the first thing said.
          <span className="sr-only">{SR_PREFIX[variant]}: </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export type AlertTitleProps = HTMLAttributes<HTMLParagraphElement>;

export function AlertTitle({ className, ...rest }: AlertTitleProps) {
  return <p {...rest} className={cn('font-semibold', className)} />;
}

export type AlertDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function AlertDescription({ className, ...rest }: AlertDescriptionProps) {
  return <p {...rest} className={cn('leading-relaxed', className)} />;
}

/**
 * An alert that carries one inline recovery action.
 *
 * The slot takes a `ReactNode`, not a label string: the only correct recovery
 * for "Shipment not found" is a link to the search or a retry button wired to
 * real state. This component will not invent a button that does nothing.
 */
export type AlertActionProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export function AlertAction({ className, children, ...rest }: AlertActionProps) {
  if (!children) return null;
  return (
    <div {...rest} className={cn('mt-3 flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}
