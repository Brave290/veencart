import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/cn';
import { buttonVariants } from './button';

/**
 * CARD
 * ----
 * A surface, not a control. The whole point of splitting the variants is the
 * accessibility rule that most card libraries get wrong: a card that lifts,
 * shadows and darkens its border on hover is TELLING the user it is clickable.
 * If it is not clickable, that is a lie the user pays for by pressing it and
 * getting nothing back.
 *
 * SO THE TYPE SYSTEM ENFORCES IT
 *   `Card` accepts `default | outlined | muted`. It CANNOT accept
 *   `interactive` — the compiler is the guard rail, not a code review.
 *   The interactive surface styling is reachable only through `CardLink`
 *   (renders a real `<a>` via next/link) and `CardButton` (renders a real
 *   `<button>`), both of which are focusable, activatable and announced.
 *
 * THE OTHER WAY TO BUILD AN INTERACTIVE CARD
 * When the card contains its own controls (a checkbox, a row action menu), a
 * stretched link is better than wrapping everything in one link: the title
 * stays the single link, and `after:absolute after:inset-0` makes the rest of
 * the surface activate it. That gives ONE tab stop instead of one per control.
 * `cardLinkOverlayClass` is that recipe. Do not use it when the card also
 * holds a separate interactive control — the overlay will cover it.
 *
 * MOTION
 * `lift` (from frontend/src/app/motion.css) supplies the hover rise. It is already
 * wrapped in `@media (hover: hover)`, so a tap on a phone cannot leave a card
 * stuck in its hover state — a real bug on Android Chrome.
 *
 * PADDING
 * `Card` itself has no padding. Each sub-component owns its own, so a card can
 * still be a flush media container (a product photo edge-to-edge) without a
 * `p-0` override fighting the default.
 */

/**
 * POINTER HOVER, NOT STICKY HOVER
 * `[@media(hover:hover)]:` is written out on purpose. Tailwind v4's `hover:`
 * variant compiles to an unconditional `:hover` rule — it does NOT wrap it in
 * `@media (hover: hover)` — so on a phone the first tap latches the card into
 * its hover state and it stays lifted and outlined until the user taps
 * somewhere else. For a card that "looks clickable", a permanently outlined
 * card after a tap reads as selected, which is a lie. `lift` in motion.css
 * already has this guard for the transform; these two need it by hand.
 */
const HOVER_HOVER = '[@media(hover:hover)]:';

/** Static surfaces. `interactive` is deliberately absent — see above. */
export type CardVariant = 'default' | 'outlined' | 'muted';

/** The full variant set. Only the interactive CONTROL components may use it. */
export type CardSurfaceVariant = CardVariant | 'interactive';

const VARIANT_CLASS: Record<CardSurfaceVariant, string> = {
  default: 'bg-surface border-line shadow-xs',
  outlined: 'bg-transparent border-line',
  muted: 'bg-surface-muted border-line-subtle',
  interactive: `bg-surface border-line shadow-xs cursor-pointer ${HOVER_HOVER}border-primary-ring ${HOVER_HOVER}shadow-md focus-visible:rounded-md`,
};

const BASE =
  'relative min-w-0 rounded-md border transition-[transform,box-shadow,border-color] duration-base ease-enter';

export type CardVariantsOptions = {
  variant?: CardSurfaceVariant;
  className?: string;
};

/**
 * The class recipe for a card surface.
 *
 * Exported so a `<li>`, an `<article>` or a grid item can be a card without
 * pretending to be a `<div>`, and so `CardLink` / `CardButton` stay identical
 * to a plain `Card` apart from the hover affordance.
 */
export function cardVariants({
  variant = 'default',
  className,
}: CardVariantsOptions = {}): string {
  return cn(BASE, VARIANT_CLASS[variant], className);
}

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({ variant = 'default', className, ...rest }: CardProps) {
  return <div {...rest} className={cardVariants({ variant, className })} />;
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, ...rest }: CardHeaderProps) {
  return (
    <div
      {...rest}
      className={cn(
        // `flex-wrap` matters at 320px: a long reference plus a status badge
        // must wrap rather than squeeze the title to one character per line.
        'flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5',
        className,
      )}
    />
  );
}

const TITLE_TAG = {
  h2: 'text-lg',
  h3: 'text-base',
  h4: 'text-sm',
  h5: 'text-sm',
  p: 'text-base',
  span: 'text-base',
} as const;

export type CardTitleProps = HTMLAttributes<HTMLElement> & {
  /**
   * Heading element. `h3` by default because cards normally sit under a
   * section `h2`. Choose the level that matches the document outline — a card
   * title that is not a heading is a title a screen reader cannot jump to.
   */
  as?: keyof typeof TITLE_TAG;
};

export function CardTitle({ as: Tag = 'h3', className, ...rest }: CardTitleProps) {
  return (
    <Tag
      {...rest}
      className={cn(
        'min-w-0 font-semibold text-content text-balance',
        TITLE_TAG[Tag],
        className,
      )}
    />
  );
}

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({ className, ...rest }: CardDescriptionProps) {
  return (
    <p {...rest} className={cn('mt-0.5 text-sm text-content-muted', className)} />
  );
}

export type CardContentProps = HTMLAttributes<HTMLDivElement>;

export function CardContent({ className, ...rest }: CardContentProps) {
  return <div {...rest} className={cn('px-4 py-4 sm:px-5', className)} />;
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CardFooter({ className, ...rest }: CardFooterProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5',
        className,
      )}
    />
  );
}

/**
 * The trailing slot in a header — a status badge, a reference code, an action.
 * Given `ml-auto` so it right-aligns without the caller adding it, and allowed
 * to wrap rather than crush the title at 320px.
 */
export type CardActionProps = HTMLAttributes<HTMLDivElement>;

export function CardAction({ className, ...rest }: CardActionProps) {
  return (
    <div {...rest} className={cn('ml-auto flex shrink-0 items-center gap-2', className)} />
  );
}

/* ========================================================================== */
/* THE INTERACTIVE SURFACES — the only two ways a card may look clickable      */
/* ========================================================================== */

export type CardLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: CardSurfaceVariant;
  className?: string;
};

/**
 * A card that IS a link. The whole surface is one anchor: one tab stop, one
 * accessible name, middle-click and "open in new tab" all work because it is a
 * real link and not a div with a click handler.
 */
export function CardLink({ variant = 'interactive', className, ...rest }: CardLinkProps) {
  return <Link {...rest} className={cn(cardVariants({ variant, className }), 'lift block')} />;
}

export type CardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CardSurfaceVariant;
};

/**
 * A card that IS a button — for selecting a saved address or a saved card,
 * where activating the card commits a choice rather than navigating.
 *
 * `type` defaults to `"button"`, same reasoning as `Button`: a bare `<button>`
 * inside a form submits it.
 */
export function CardButton({
  variant = 'interactive',
  type = 'button',
  className,
  ...rest
}: CardButtonProps) {
  return (
    <button {...rest} type={type} className={cn(cardVariants({ variant, className }), 'lift block')} />
  );
}

/**
 * Stretch-link recipe for a card that contains its own controls.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle><Link href="/staff/shipments/VC-8471" className={cardLinkOverlayClass}>VC-8471</Link></CardTitle>
 *     </CardHeader>
 *   </Card>
 *
 * The pseudo-element carries the hit area and the focus ring; the link text
 * itself is what a screen reader announces. One tab stop for the whole card.
 *
 * Never combine this with a separate control inside the same card — the
 * `::after` layer sits above it and swallows the click.
 */
export const cardLinkOverlayClass = [
  'after:absolute after:inset-0 after:rounded-md after:content-[""]',
  'focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary',
].join(' ');

/**
 * A card that is entirely one action, rendered as a link and styled with the
 * button recipe. Use when the card has no internal structure worth announcing
 * separately — e.g. a single "Track this parcel" card.
 */
export type CardLinkButtonProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  className?: string;
  children: ReactNode;
};

export function CardLinkButton({ className, children, ...rest }: CardLinkButtonProps) {
  return (
    <Link {...rest} className={cn(buttonVariants(), 'justify-between', className)}>
      {children}
    </Link>
  );
}
