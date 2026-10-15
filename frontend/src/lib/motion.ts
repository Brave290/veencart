/**
 * Motion tokens — TypeScript mirror of frontend/src/app/motion.css.
 *
 * WHY A MIRROR RATHER THAN READING THE CSS
 * Motion durations and curves are needed in three places: CSS (the stylesheet),
 * React (inline transition objects for the few JS-animated components), and
 * tests (asserting the reduced-motion contract). Reading a custom property at
 * runtime costs a layout read and returns a string; a typed constant is free.
 *
 * Keep this file and the @theme block in motion.css in lockstep. The values
 * below are the contract; motion.css is the implementation.
 */

/** Duration bands. Named by intent, not by value. */
export const duration = {
  /** No transition — the state is already correct. */
  instant: 0,
  /** Hover, focus, press, colour change. Under 200ms reads as instant. */
  fast: 120,
  /** Dropdown, tooltip, badge, inline reveal. */
  base: 200,
  /** Dialog, drawer, accordion, page section. */
  moderate: 280,
  /** Full-surface transition. A ceiling, not a default. */
  slow: 400,
} as const;

/** Exit is deliberately shorter than entrance — see motion.css. */
export const exitDuration = {
  fast: 90,
  base: 150,
  moderate: 210,
} as const;

/**
 * Easing direction carries meaning. This is not a taste call.
 *  - enter : arriving, fast start, decelerating settle (physical arrival)
 *  - exit  : leaving, accelerating away (the user already decided)
 *  - move  : staying put, changing between two states (symmetric)
 *  - linear: indeterminate progress only — an easing curve on a spinner whose
 *            duration is unknown is decoration.
 */
export const ease = {
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  move: 'cubic-bezier(0.65, 0, 0.35, 1)',
  linear: 'linear',
} as const;

/** Choreography. See <Stagger> in components/motion/reveal.tsx. */
export const stagger = {
  /** Gap between siblings. Below 30ms reads as pasted-on. */
  child: 50,
  /** Never stagger past this. The tail waits too long and looks broken. */
  maxChildren: 6,
  /** How far an element travels on reveal. Enough to read, not enough to wait. */
  distance: '12px',
} as const;

export const motion = {
  duration,
  exitDuration,
  ease,
  stagger,
} as const;

export type Motion = typeof motion;

/**
 * Properties this system permits animating.
 *
 * The list is short because the rule is hard: only `transform` and `opacity`
 * are composited off the main thread. Anything else — width, height, top,
 * left, margin, padding — forces layout on every frame and drops frames on
 * exactly the low-end Android devices this product targets.
 *
 * `colour` and `border-color` are permitted deliberately: they are cheap,
 * common, and do not trigger layout on the compositor path for the small
 * colour deltas used here.
 */
export const ANIMATABLE = [
  'transform',
  'opacity',
  'color',
  'background-color',
  'border-color',
  'box-shadow',
] as const;

export type AnimatableProperty = (typeof ANIMATABLE)[number];

/**
 * Build a transition string from named parts.
 *
 * `transition: all` is banned in this project. It animates properties you did
 * not intend, including ones a later developer adds. This helper makes the
 * explicit form the easy form:
 *
 *   motionTransition(['transform', 'opacity'], duration.base, ease.enter)
 *   // "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ..."
 */
export function motionTransition(
  properties: readonly AnimatableProperty[],
  ms: number = duration.base,
  curve: string = ease.enter
): string {
  if (properties.length === 0) {
    throw new Error(
      'motionTransition: list the properties you animate. "transition: all" is banned ' +
        'in this project because it animates properties you did not intend.'
    );
  }
  return properties.map((p) => `${p} ${ms}ms ${curve}`).join(', ');
}