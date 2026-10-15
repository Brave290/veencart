import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/cn';

/**
 * BUTTON
 * -------
 * Renders a real `<button>`. It does NOT render an `<a>`: navigation is a link
 * and links are anchors, and a control that navigates should be an `<a>` so
 * middle-click, "open in new tab" and the browser's link affordances all work.
 * For that case use `buttonVariants()` on a `<Link>`.
 *
 * TEAL AND ORANGE NEVER SHARE A SCREEN
 * `primary` is teal and means "the platform does this". `secondary` is the
 * teal tint — still operational. Orange is deliberately absent from this
 * component: it is the accent action (start a quote, move money) and is
 * owned by the surface that sells it, not by the primitive.
 *
 * TOUCH TARGETS
 * Base sizes are the 44px mobile minimum. At `md` and up they shrink to the
 * dense desktop rhythm so tables of actions do not balloon. This is why the
 * height is `min-h-11 md:min-h-9` and not a single value.
 *
 * A11y contract
 * - `type` defaults to `"button"`. A bare `<button>` inside a form submits it,
 *   which has caused real data loss; this is not optional.
 * - `iconOnly` is type-enforced to require `aria-label`. An icon-only button
 *   with no accessible name is invisible to a screen reader, so the type
 *   system refuses to let one be written.
 * - `loading` sets `aria-busy` and disables the control, but keeps the label
 *   in the DOM so the accessible name does not disappear mid-interaction.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover active:bg-primary-active',
  secondary:
    'bg-primary-subtle text-primary-hover hover:bg-primary-subtle-hover active:bg-primary-subtle-hover',
  outline:
    'border border-line-strong bg-surface text-content hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'bg-transparent text-content hover:bg-surface-muted active:bg-surface-muted',
  danger: 'bg-danger-strong text-danger-fg shadow-xs hover:bg-danger-strong-hover active:bg-danger-strong-hover',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  // min-h-11 = 44px touch target on mobile; md:min-h-9/10 = dense desktop.
  sm: 'min-h-11 md:min-h-9 gap-1.5 px-3 text-sm',
  md: 'min-h-11 md:min-h-10 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2.5 px-5 text-base',
};

const ICON_ONLY_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'size-11 md:size-9 px-0',
  md: 'size-11 md:size-10 px-0',
  lg: 'size-12 px-0',
};

export type ButtonVariantsOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
};

/**
 * The class recipe for a button.
 *
 * Exported so a `<Link>` or an `<a>` can be styled as a button without
 * duplicating these strings, and so a server-rendered pagination link can
 * match the client-side button exactly.
 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className,
}: ButtonVariantsOptions = {}): string {
  return cn(
    // No `whitespace-nowrap`: at 320px a long CTA ("Start a shipping quote")
    // must wrap rather than push the page sideways. Most labels never wrap.
    'inline-flex shrink-0 items-center justify-center rounded-sm font-semibold text-balance',
    'transition-colors duration-fast ease-out',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55',
    'aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
    VARIANT_CLASS[variant],
    iconOnly ? ICON_ONLY_SIZE_CLASS[size] : SIZE_CLASS[size],
    className,
  );
}

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets `aria-busy` and blocks activation. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

/**
 * `iconOnly` and `aria-label` are tied together by a discriminated union so the
 * compiler — not a code review — is what guarantees every icon-only button is
 * named.
 */
export type ButtonProps = ButtonBaseProps &
  (
    | { iconOnly?: false; 'aria-label'?: string }
    | { iconOnly: true; 'aria-label': string }
  );

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  disabled = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isInert = disabled || loading;

  return (
    <button
      type={type}
      // Spread first so the two props below cannot be silently overridden by a
      // consumer and break the loading / icon-only contract.
      {...rest}
      disabled={isInert}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, iconOnly, className })}
    >
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin-slow motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}
