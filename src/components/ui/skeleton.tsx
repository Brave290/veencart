import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * SKELETON
 * --------
 * A placeholder block shaped like the content that is coming.
 *
 * STILL BY DEFAULT, AND THAT IS THE POINT
 * The usual skeleton is a shimmer looping forever. It looks busy, and it is
 * the wrong tool: a user who wants to read the page is now reading a lightbulb
 * oscillating at 1.6Hz, and a screen-reader user is reading nothing at all
 * because the blocks are empty divs.
 *
 * So the animation is opt-in (`animate`), not opt-out. When it IS on it is an
 * opacity pulse — `--animate-skeleton-pulse` in globals.css, `0.45` opacity at
 * the trough — and NOT the background-position gradient the tutorials use,
 * which repaints the whole box every frame. Opacity is composited; a
 * background-position sweep is not. On four skeletons over a 3G connection on
 * the low-end Android handsets this audience actually carries, the difference
 * is the difference between a janky page and a smooth one.
 *
 * `motion-reduce:animate-none` stops the pulse for anyone who asked the
 * operating system for less movement. Note this is deliberately NOT
 * `data-motion-essential`: that attribute exists in motion.css for
 * INDETERMINATE progress (a stopped spinner reads as broken), and a skeleton
 * is the opposite — it has a known end, so stillness is honest.
 *
 * NOTHING IS EVER INVISIBLE
 * Skeletons never hide real content, and the real content is always the
 * server-rendered state. There is no `opacity: 0` start state anywhere in this
 * file, so a JavaScript failure or a blocked stylesheet degrades to a page of
 * grey boxes and never to a blank screen.
 *
 * A skeleton is `aria-hidden` and always sits inside something that carries
 * the announcement. A screen-reader user gets "Loading shipments" once, not
 * forty empty divs. That is what `LoadingBlock` is for.
 */

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Opt in to the opacity pulse. Off by default — see the header comment. */
  animate?: boolean;
};

export function Skeleton({ animate = false, className, ...rest }: SkeletonProps) {
  return (
    <div
      {...rest}
      aria-hidden="true"
      className={cn(
        'rounded-sm bg-surface-muted',
        animate && 'animate-skeleton-pulse motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export type SkeletonTextProps = {
  /** Number of text lines. */
  lines?: number;
  animate?: boolean;
  className?: string;
  /** Class for the wrapping stack. */
  wrapperClassName?: string;
};

/**
 * A paragraph-shaped skeleton. The final line is deliberately shorter — a stack
 * of identical full-width bars reads as a table, not as a sentence, and the
 * eye expects the ragged right edge of real prose.
 */
export function SkeletonText({
  lines = 3,
  animate = false,
  className,
  wrapperClassName,
}: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          animate={animate}
          className={cn('h-4', index === lines - 1 ? 'w-3/5' : 'w-full', className)}
        />
      ))}
    </div>
  );
}

export type SkeletonCircleProps = HTMLAttributes<HTMLDivElement> & {
  animate?: boolean;
};

/** An avatar-sized disc. */
export function SkeletonCircle({ animate = false, className, ...rest }: SkeletonCircleProps) {
  return (
    <div
      {...rest}
      aria-hidden="true"
      className={cn(
        'size-10 rounded-pill bg-surface-muted',
        animate && 'animate-skeleton-pulse motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export type LoadingBlockProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * What is loading, in plain words: "Loading shipments", "Loading quote".
   * This is the ONLY thing a screen-reader user is told, so it has to be
   * specific. "Loading" on its own tells a blind dispatcher nothing about
   * whether the thing they are waiting for is on its way.
   */
  label: string;
};

/**
 * Wraps a skeleton group and owns the announcement.
 *
 * `role="status"` is a polite live region: it waits for the screen reader to
 * finish its current utterance rather than cutting across it, which is the
 * right register for "something is arriving".
 *
 * There is deliberately no `animate` prop here. The children are arbitrary
 * nodes, so this component cannot turn their animation on for them, and a prop
 * that looks like it does something and does not is worse than no prop. Pass
 * `animate` to each `Skeleton` instead.
 */
export function LoadingBlock({ label, className, children, ...rest }: LoadingBlockProps) {
  return (
    <div {...rest} role="status" aria-live="polite" className={cn(className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  /**
   * Announced to screen readers. Optional only because this is almost always
   * placed inside a button that already carries its own accessible name —
   * "Save, Loading" is useful, and a bare second "Loading" on its own is not.
   */
  label?: string;
};

/**
 * A busy indicator for short, action-specific work — a button submit, a save.
 * NOT for page loads: a skeleton is faster to read than a spinner and shows
 * the shape of what is coming.
 *
 * `data-motion-essential` is motion.css's documented exception: indeterminate
 * progress KEEPS ANIMATING under reduced motion, because a frozen spinner
 * reads as a broken interface rather than a calm one. Reduced motion removes
 * gratuitous movement, not signal.
 */
export function Spinner({ label = 'Loading', className, ...rest }: SpinnerProps) {
  return (
    <span {...rest} role="status" data-motion-essential className={cn('inline-flex', className)}>
      <span
        aria-hidden="true"
        className="size-4 animate-spin-slow rounded-pill border-2 border-current border-t-transparent"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
