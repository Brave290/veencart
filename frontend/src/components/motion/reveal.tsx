'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Reveal — animates content the first time it scrolls into view.
 *
 * WHY THIS IS NOT SIMPLE `opacity-0` + `whileInView`
 * The naive implementation hides the element in CSS and reveals it with
 * JavaScript. If the script fails, is blocked, or the user has reduced motion
 * enabled, the content STAYS INVISIBLE — a blank section on a page. That is
 * the single most common way scroll-reveal is shipped broken, and it is worse
 * than having no animation at all.
 *
 * The order of operations here is deliberate:
 *   1. The server renders content fully VISIBLE. That is the default state.
 *   2. A tiny blocking script in <head> adds `js-reveal-armed` to <html> —
 *      but ONLY when the user has not asked for reduced motion.
 *   3. CSS hides `.reveal` only when BOTH the class is present AND the media
 *      query matches. Miss either, and the element stays visible.
 *   4. This component adds `.is-revealed` when the element enters the viewport.
 *
 * Consequences, all of which are the point:
 *   - No JS              -> visible. Nothing is hidden.
 *   - Reduced motion     -> visible. No movement, full content.
 *   - JS error           -> visible. The observer simply never fires.
 *   - Slow connection    -> visible immediately, animates when it arrives.
 *
 * Every one of those failure modes degrades to "you see the content", which is
 * the only acceptable direction for a failure.
 */

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Render as a different element, e.g. "li" inside a list. */
  as?: ElementType;
  /**
   * Negative rootMargin fires the reveal slightly before the element is fully
   * on screen. Waiting until it is visible means the user watches it animate
   * in rather than arriving at something already moving.
   */
  rootMargin?: string;
  /** Reveal once, then stop observing. Default true — re-animating on every
   *  scroll back up is noise. */
  once?: boolean;
};

export function Reveal({
  children,
  className,
  as: Tag = 'div',
  rootMargin = '0px 0px -12% 0px',
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already visible or already revealed: nothing to do. Covers the
    // reduced-motion path, where `js-reveal-armed` is absent and the element
    // was never hidden.
    const armed =
      document.documentElement.classList.contains('js-reveal-armed');
    if (!armed || node.classList.contains('is-revealed')) return;

    if (typeof IntersectionObserver === 'undefined') {
      // No observer support: reveal immediately rather than hiding forever.
      node.classList.add('is-revealed');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          if (once) observer.unobserve(entry.target);
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    // Always disconnect: a page route change unmounts this, and a live
    // observer on a detached node is a leak on a long-lived session.
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return (
    <Tag ref={ref} className={cn('reveal', className)}>
      {children}
    </Tag>
  );
}

/**
 * Stagger — reveals direct children in sequence.
 *
 * THE 30–50ms OFFSET IS THE WHOLE EFFECT. It reads as weight: the container
 * moves first and its contents catch up, the way a real object behaves. The
 * first child is never delayed — delaying the thing the user is already
 * looking at reads as sloppiness.
 *
 * Capped at 6 children (`--stagger-children`). Past that, the last item waits
 * too long and the list feels broken rather than choreographed.
 */
export function Stagger({
  children,
  className,
  max = 6,
}: {
  children: ReactNode[];
  className?: string;
  max?: number;
}) {
  // Rendered as a plain wrapper: children are already the real elements, and
  // cloning them would fight whatever the caller passed in.
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Same three gates as <Reveal>. Miss any one and the children are simply
    // visible — there is no state that can get stuck in the wrong place.
    if (!document.documentElement.classList.contains('js-reveal-armed')) return;

    const reveal = () => {
      node.classList.add('is-revealed');
      for (const child of Array.from(node.children)) {
        child.classList.add('is-revealed');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Capped at `max` — past 6 the tail waits too long and reads as broken.
  const items = children.slice(0, max);

  // Deliberately NOT React state. Toggling a class on the DOM is what the
  // browser needs anyway, it keeps this out of the render path entirely, and
  // it avoids a render cycle for a one-way purely visual transition.
  return (
    <div ref={ref} className={cn('stagger', className)}>
      {items.map((child, i) => (
        <div key={i} style={{ '--stagger-index': i } as React.CSSProperties}>
          {child}
        </div>
      ))}
    </div>
  );
}