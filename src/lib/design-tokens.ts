/**
 * VEENCART LOGISTICS — DESIGN TOKENS (TypeScript mirror)
 *
 * This file is a FAITHFUL MIRROR of `src/app/globals.css`. The CSS is the
 * source of truth; this is the typed copy for consumers that cannot read CSS:
 *
 *   - React Server Components passing a colour to an inline `style`
 *   - `<meta name="theme-color">` and PWA manifest entries
 *   - SVG / canvas / chart series colours, which take `oklch()` strings directly
 *   - tests that assert a token resolved to the value the design system expects
 *   - documentation generation
 *
 * TWO RULES KEEP THIS FILE HONEST:
 *
 *   1. Never edit a value here that is not in globals.css. If the two ever
 *      disagree, globals.css wins and this file is the bug.
 *   2. Never add a token here that is not in the `@theme` block. This is a
 *      mirror, not a second design system. If a component needs a colour that
 *      does not exist, the correct fix is a new SEMANTIC token in globals.css,
 *      not a raw ramp step smuggled in through TypeScript.
 *
 * Every colour value is an `oklch()` string — a valid CSS colour, usable in
 * `style={{ backgroundColor: ... }}`, `fill=` and `stroke=` without conversion.
 * The WCAG contrast ratios measured for the semantic pairs are recorded in the
 * comments; they are NOT re-measured here, they are copied from the CSS.
 *
 * @see src/app/globals.css — the source of truth
 */

/* ========================================================================== */
/* COLOUR                                                                     */
/* ========================================================================== */

/** Raw ramps. Components may NOT use these — the semantic layer below exists
 *  precisely so a component never has to reach past a brand decision. They are
 *  exported for data-viz and for building new semantic tokens. */
const ramp = {
  teal: {
    50: 'oklch(0.977 0.014 184)',
    100: 'oklch(0.94 0.033 184)',
    200: 'oklch(0.88 0.065 184)',
    300: 'oklch(0.8 0.09 184)',
    400: 'oklch(0.706 0.099 184)',
    500: 'oklch(0.612 0.098 184)',
    600: 'oklch(0.522 0.088 184)', // 5.21:1 on white — lowest teal safe for text
    700: 'oklch(0.436 0.074 184)', // 7.60:1
    800: 'oklch(0.352 0.06 184)', // 10.89:1
    900: 'oklch(0.272 0.045 184)', // 14.71:1
    950: 'oklch(0.196 0.032 184)',
  },
  orange: {
    50: 'oklch(0.977 0.019 58)',
    100: 'oklch(0.941 0.046 58)',
    200: 'oklch(0.888 0.085 58)',
    300: 'oklch(0.82 0.122 58)',
    400: 'oklch(0.745 0.152 58)',
    500: 'oklch(0.668 0.168 58)', // 2.1:1 on white — never text
    600: 'oklch(0.588 0.172 58)', // 4.33:1 white-on-fill — FAILS AA
    700: 'oklch(0.508 0.16 58)', // 6.03:1 white-on-fill — lowest safe accent fill
    800: 'oklch(0.432 0.14 58)', // 8.32:1
    900: 'oklch(0.36 0.114 58)',
    950: 'oklch(0.268 0.078 58)',
  },
  neutral: {
    50: 'oklch(0.986 0.002 86)',
    100: 'oklch(0.968 0.003 86)',
    200: 'oklch(0.924 0.005 86)',
    300: 'oklch(0.872 0.006 86)',
    400: 'oklch(0.712 0.008 86)', // 2.55:1 — must never carry text
    500: 'oklch(0.566 0.009 86)', // 4.54:1 — lightest step allowed as muted text
    600: 'oklch(0.452 0.009 86)',
    700: 'oklch(0.372 0.009 86)',
    800: 'oklch(0.282 0.008 86)',
    900: 'oklch(0.208 0.007 86)',
    950: 'oklch(0.148 0.006 86)',
  },
  success: {
    50: 'oklch(0.975 0.022 152)',
    100: 'oklch(0.94 0.058 152)',
    200: 'oklch(0.88 0.104 152)',
    300: 'oklch(0.8 0.132 152)',
    400: 'oklch(0.706 0.142 152)',
    500: 'oklch(0.612 0.138 152)',
    600: 'oklch(0.522 0.12 152)',
    700: 'oklch(0.436 0.1 152)',
    800: 'oklch(0.352 0.079 152)',
    900: 'oklch(0.272 0.058 152)',
    950: 'oklch(0.196 0.04 152)',
  },
  warning: {
    50: 'oklch(0.984 0.024 80)',
    100: 'oklch(0.958 0.058 80)',
    200: 'oklch(0.906 0.11 80)',
    300: 'oklch(0.836 0.146 78)',
    400: 'oklch(0.756 0.164 72)',
    500: 'oklch(0.668 0.168 60)',
    600: 'oklch(0.566 0.15 52)',
    700: 'oklch(0.462 0.12 46)',
    800: 'oklch(0.372 0.09 41)',
    900: 'oklch(0.282 0.062 41)',
    950: 'oklch(0.208 0.042 41)',
  },
  danger: {
    50: 'oklch(0.971 0.012 24)',
    100: 'oklch(0.936 0.03 24)',
    200: 'oklch(0.885 0.058 24)',
    300: 'oklch(0.808 0.104 24)',
    400: 'oklch(0.706 0.16 24)',
    500: 'oklch(0.612 0.202 24)',
    600: 'oklch(0.522 0.216 24)',
    700: 'oklch(0.436 0.198 24)', // 8.65:1 white-on-fill
    800: 'oklch(0.352 0.164 24)',
    900: 'oklch(0.272 0.124 24)',
    950: 'oklch(0.196 0.084 24)',
  },
  info: {
    50: 'oklch(0.971 0.013 254)',
    100: 'oklch(0.936 0.03 254)',
    200: 'oklch(0.885 0.056 254)',
    300: 'oklch(0.808 0.096 254)',
    400: 'oklch(0.712 0.14 254)',
    500: 'oklch(0.618 0.17 254)',
    600: 'oklch(0.526 0.186 254)',
    700: 'oklch(0.44 0.176 254)',
    800: 'oklch(0.36 0.148 254)',
    900: 'oklch(0.288 0.114 254)',
    950: 'oklch(0.212 0.078 254)',
  },
} as const;

/** The semantic layer. THIS is what components are allowed to consume. */
const color = {
  // Surfaces
  canvas: 'oklch(0.986 0.002 86)', // warm off-white page background
  surface: 'oklch(1 0 0)', // cards, panels, sheets
  'surface-muted': 'oklch(0.968 0.003 86)', // table headers, inset wells
  'surface-sunken': 'oklch(0.986 0.002 86)',

  // Content
  content: 'oklch(0.208 0.007 86)', // 14.50:1 on canvas
  'content-muted': 'oklch(0.452 0.009 86)', // 7.38:1
  'content-subtle': 'oklch(0.535 0.009 86)', // 4.95:1 on canvas
  'content-inverted': 'oklch(1 0 0)',
  'content-disabled': 'oklch(0.566 0.009 86)', // WCAG 1.4.3 exempts disabled controls

  // Borders
  line: 'oklch(0.872 0.006 86)', // dividers — no contrast duty
  'line-strong': 'oklch(0.566 0.009 86)', // form-control edges — 4.54:1, passes 1.4.11
  'line-subtle': 'oklch(0.924 0.005 86)',

  // Primary action (teal — operational)
  primary: 'oklch(0.436 0.074 184)', // white text 7.60:1
  'primary-hover': 'oklch(0.352 0.06 184)', // 10.89:1
  'primary-active': 'oklch(0.272 0.045 184)', // 14.71:1
  'primary-subtle': 'oklch(0.94 0.033 184)', // teal-100 tinted button
  'primary-subtle-hover': 'oklch(0.88 0.065 184)',
  'primary-fg': 'oklch(1 0 0)',
  'primary-ring': 'oklch(0.522 0.088 184)', // 5.21:1 — for rings on teal-100

  // Accent action (orange — commercial: quotes, pricing, money)
  accent: 'oklch(0.508 0.16 58)', // white text 6.03:1
  'accent-hover': 'oklch(0.432 0.14 58)', // 8.32:1
  'accent-active': 'oklch(0.36 0.114 58)',
  'accent-subtle': 'oklch(0.941 0.046 58)',
  'accent-subtle-hover': 'oklch(0.888 0.085 58)',
  'accent-fg': 'oklch(1 0 0)',

  // Danger
  'danger-strong': 'oklch(0.436 0.198 24)', // white on it = 8.65:1
  'danger-strong-hover': 'oklch(0.352 0.164 24)',
  'danger-fg': 'oklch(1 0 0)',
  'danger-subtle': 'oklch(0.936 0.03 24)',
  'danger-subtle-hover': 'oklch(0.885 0.058 24)',
  'danger-text': 'oklch(0.436 0.198 24)', // on a light tint = 8.65:1

  // Success
  'success-text': 'oklch(0.352 0.079 152)',
  'success-surface': 'oklch(0.94 0.058 152)',
  'success-border': 'oklch(0.436 0.1 152)',
  'success-fg': 'oklch(1 0 0)', // on success-700 = 7.53:1

  // Warning
  'warning-text': 'oklch(0.372 0.09 41)',
  'warning-surface': 'oklch(0.958 0.058 80)',
  'warning-border': 'oklch(0.462 0.12 46)',
  'warning-fg': 'oklch(1 0 0)', // on warning-700 #8d3e10 = 5.92:1

  // Info
  'info-text': 'oklch(0.36 0.148 254)',
  'info-surface': 'oklch(0.936 0.03 254)',
  'info-border': 'oklch(0.44 0.176 254)',
  'info-fg': 'oklch(1 0 0)', // on info-700 = 7.84:1

  // Focus
  focus: 'oklch(0.522 0.088 184)', // 5.21:1 on canvas, 4.75:1 on surface-muted
  'focus-offset': 'oklch(1 0 0)',
} as const;

/* ========================================================================== */
/* STATUS FAMILIES — 16 shipment statuses collapse to 6 families             */
/* ========================================================================== */

/**
 * Measured WCAG 2.1 contrast of text-on-surface. AA needs 4.5:1 for body text.
 * These six families are the complete colour vocabulary for shipment state.
 * Colour is never the only channel (WCAG 1.4.1) — a status always ships with a
 * glyph and a human-readable label alongside the tint.
 *
 * NOTE: `warning` text (#784f00) sits only 11° from the neutral family hue.
 * They stay distinguishable by three further channels — icon glyph, surface
 * tint (warm grey vs amber) and the ring. Never collapse a badge to colour
 * alone.
 */
const statusFamilies = {
  neutral: {
    surface: 'oklch(0.968 0.003 86)',
    text: 'oklch(0.372 0.009 86)',
    edge: 'oklch(0.872 0.006 86)',
    contrast: '9.43:1',
  },
  info: {
    surface: 'oklch(0.936 0.03 254)',
    text: 'oklch(0.44 0.176 254)',
    edge: 'oklch(0.618 0.17 254)',
    contrast: '6.51:1',
  },
  brand: {
    surface: 'oklch(0.94 0.033 184)',
    text: 'oklch(0.352 0.06 184)',
    edge: 'oklch(0.522 0.088 184)',
    contrast: '9.25:1',
  },
  success: {
    surface: 'oklch(0.94 0.058 152)',
    text: 'oklch(0.352 0.079 152)',
    edge: 'oklch(0.436 0.1 152)',
    contrast: '9.27:1',
  },
  warning: {
    surface: 'oklch(0.958 0.058 80)',
    text: 'oklch(0.372 0.09 41)',
    edge: 'oklch(0.756 0.164 72)',
    contrast: '6.35:1',
  },
  danger: {
    surface: 'oklch(0.936 0.03 24)',
    text: 'oklch(0.352 0.164 24)',
    edge: 'oklch(0.612 0.202 24)',
    contrast: '9.82:1',
  },
} as const;

/** Flattened `--color-status-*` names, mirroring the CSS variable names so a
 *  value can be traced back to its variable in one step. */
const statusColor = {
  'status-neutral-surface': statusFamilies.neutral.surface,
  'status-neutral-text': statusFamilies.neutral.text,
  'status-neutral-edge': statusFamilies.neutral.edge,
  'status-info-surface': statusFamilies.info.surface,
  'status-info-text': statusFamilies.info.text,
  'status-info-edge': statusFamilies.info.edge,
  'status-brand-surface': statusFamilies.brand.surface,
  'status-brand-text': statusFamilies.brand.text,
  'status-brand-edge': statusFamilies.brand.edge,
  'status-success-surface': statusFamilies.success.surface,
  'status-success-text': statusFamilies.success.text,
  'status-success-edge': statusFamilies.success.edge,
  'status-warning-surface': statusFamilies.warning.surface,
  'status-warning-text': statusFamilies.warning.text,
  'status-warning-edge': statusFamilies.warning.edge,
  'status-danger-surface': statusFamilies.danger.surface,
  'status-danger-text': statusFamilies.danger.text,
  'status-danger-edge': statusFamilies.danger.edge,
} as const;

/* ========================================================================== */
/* TYPOGRAPHY                                                                 */
/* ========================================================================== */

const font = {
  // next/font supplies --font-inter / --font-jakarta / --font-jetbrains.
  // Each stack ends in a real generic fallback, so the system stays
  // readable before (or without) the webfont.
  sans: "var(--font-inter, 'Inter'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  display:
    "var(--font-jakarta, 'Plus Jakarta Sans'), var(--font-inter, 'Inter'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  mono: "var(--font-jetbrains, 'JetBrains Mono'), ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

/**
 * 1.250 major third on a 16px base. Line height is per step, not global:
 * display text needs ~1.1 so it does not look loose, body needs 1.5, and the
 * dense steps (2xs/xs/sm) need ~1.4 so table rows stay tight without clipping
 * descenders.
 */
const fontSize = {
  '2xs': { size: '0.6875rem', lineHeight: '1rem' }, // 11px — micro-labels, legal
  xs: { size: '0.75rem', lineHeight: '1.125rem' }, // 12px — badges, table meta
  sm: { size: '0.875rem', lineHeight: '1.3125rem' }, // 14px — table cells
  base: { size: '1rem', lineHeight: '1.5rem' }, // 16px — NEVER below 16 on mobile
  lg: { size: '1.125rem', lineHeight: '1.6875rem' },
  xl: { size: '1.25rem', lineHeight: '1.8125rem' },
  '2xl': { size: '1.5625rem', lineHeight: '2rem' },
  '3xl': { size: '1.9531rem', lineHeight: '2.375rem' },
  // Fluid display sizes: clamp() with a hard ceiling so a 4K monitor does not
  // balloon a heading.
  'display-sm': { size: 'clamp(1.5rem, 1.32rem + 0.9vw, 2rem)', lineHeight: '1.2' },
  'display-md': { size: 'clamp(1.875rem, 1.55rem + 1.6vw, 2.75rem)', lineHeight: '1.15' },
  'display-lg': { size: 'clamp(2.25rem, 1.6rem + 3.1vw, 4rem)', lineHeight: '1.08' },
} as const;

const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

const letterSpacing = {
  tighter: '-0.02em', // display sizes only — over-tight at body size
  tight: '-0.011em',
  normal: '0em',
  wide: '0.02em',
  widest: '0.08em', // uppercase eyebrow labels
} as const;

/* ========================================================================== */
/* SPACE, RADIUS, ELEVATION, MOTION                                           */
/* ========================================================================== */

/** 4px base. Every `p-*`, `gap-*`, `w-*` in Tailwind resolves off this one. */
const spacing = {
  base: '0.25rem',
  basePx: 4,
} as const;

/** Three steps and a shape. A logistics product should feel built, not bubbly. */
const radius = {
  sm: '0.375rem', // 6px — controls, inputs, badges
  md: '0.5rem', // 8px — cards, panels, table wrappers
  lg: '0.75rem', // 12px — modals and bottom sheets only
  pill: '9999px', // avatars, status dots, count bubbles
} as const;

/** Tinted to the warm neutral hue at very low alpha so shadows read as depth
 *  on paper instead of blue-black smudges. One shadow per elevation. */
const shadow = {
  none: '0 0 0 rgb(0 0 0 / 0)',
  xs: '0 1px 2px 0 oklch(0.282 0.008 86 / 0.06)',
  sm: '0 1px 3px 0 oklch(0.282 0.008 86 / 0.08), 0 1px 2px -1px oklch(0.282 0.008 86 / 0.06)',
  md: '0 4px 8px -2px oklch(0.282 0.008 86 / 0.1), 0 2px 4px -2px oklch(0.282 0.008 86 / 0.06)',
  lg: '0 12px 20px -4px oklch(0.282 0.008 86 / 0.12), 0 4px 8px -4px oklch(0.282 0.008 86 / 0.06)',
  dialog: '0 24px 48px -12px oklch(0.148 0.006 86 / 0.24)',
} as const;

/**
 * Motion rule, one sentence: transform and opacity only, because animating
 * width/height/top/left forces layout and drops frames on the low-end Android
 * devices this audience actually uses.
 */
const easing = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)', // entrances — fast out, settles
  in: 'cubic-bezier(0.7, 0, 0.84, 0)', // exits — accelerate, do not linger
  'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)', // moves that start AND end on screen
} as const;

const duration = {
  instant: '100ms',
  fast: '140ms', // hover, press, colour change
  base: '200ms', // dialog in, tab panel change
  slow: '320ms', // page and sheet transitions, rare
} as const;

/* ========================================================================== */
/* LAYOUT                                                                     */
/* ========================================================================== */

/** 1280px content ceiling — wider and line lengths pass ~75ch, which measurably
 *  hurts form completion. */
const container = {
  content: '80rem', // 1280px
  reading: '42rem', // 672px ≈ 68ch, long-form and terms
  form: '28rem', // 448px, single-column forms
} as const;

const breakpoint = {
  xs: '30rem', // 480px — first step up; 320 is the base, not a variant
  sm: '40rem', // 640px
  md: '48rem', // 768px
  lg: '64rem', // 1024px
  xl: '80rem', // 1280px
  '2xl': '96rem', // 1536px
} as const;

/* ========================================================================== */
/* EXPORT                                                                     */
/* ========================================================================== */

export const tokens = {
  color,
  ramp,
  status: { families: statusFamilies, colors: statusColor },
  font,
  fontSize,
  fontWeight,
  letterSpacing,
  spacing,
  radius,
  shadow,
  easing,
  duration,
  container,
  breakpoint,
} as const;

/** The full token tree. Use this to type a token store, a theme override map,
 *  or a design-system documentation generator. */
export type Token = typeof tokens;

export type ColorToken = (typeof tokens)['color'];
export type StatusFamilyName = keyof typeof statusFamilies;
export type StatusFamily = (typeof statusFamilies)[StatusFamilyName];
export type FontSizeToken = keyof typeof fontSize;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadow;
export type BreakpointToken = keyof typeof breakpoint;
