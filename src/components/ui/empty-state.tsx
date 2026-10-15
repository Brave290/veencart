import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * EMPTY STATE
 * -----------
 * What a real dashboard shows instead of a blank panel.
 *
 * A blank white box tells the user one of two things — "you have no data" or
 * "this is broken" — and nothing about which, or what to do next. An empty
 * state answers both: what this place is for, and what happens next. It is the
 * difference between a product that feels finished and one that feels broken.
 *
 * IT IS NOT A CARD AND IT DOES NOT LOOK LIKE ONE
 * No hover, no lift, no pointer cursor. An empty state is a place, not a
 * control, and it must not borrow the affordances of one.
 *
 * COPY IS THE COMPONENT'S REAL JOB
 * "No data available" is not an empty state, it is an apology. The title names
 * the specific thing that is missing ("No shipments match these filters") and
 * the description says what will put something there. There is deliberately no
 * default marketing copy here beyond a plain fallback: the caller knows
 * whether the reason is "you have not created any" or "your filters exclude
 * everything", and guessing wrong is worse than asking them to write it.
 *
 * COLOUR IS NOT THE ONLY CHANNEL
 * `tone="danger"` adds an alert-coloured glyph AND changes the copy slot, not
 * just a tint. A red blob with the words "Something went wrong" is the error
 * state; a red blob alone would fail WCAG 1.4.1 for every user who cannot
 * separate red from the surface behind it.
 */

export type EmptyStateTone = 'neutral' | 'danger';

const TONE_CLASS: Record<EmptyStateTone, string> = {
  neutral: 'bg-surface-muted text-content-muted',
  // Tinted glyph well, not a red panel. A whole red block reads as a page-level
  // failure; a red icon in a neutral panel reads as "this panel failed", which
  // is the truth.
  danger: 'bg-danger-subtle text-danger-text',
};

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** Plain words for what is missing. Not "No data available". */
  title: ReactNode;
  /** What will put something here, or how to fix the filter that hid it. */
  description?: ReactNode;
  /**
   * A single meaningful glyph. Decorative — `aria-hidden` — because the title
   * already carries the meaning and two sources for one fact read twice.
   */
  icon?: LucideIcon;
  tone?: EmptyStateTone;
  size?: 'sm' | 'md';
  /**
   * The way out: a real `<Button>`, `<Link>` or `<DialogTrigger>`. A
   * `ReactNode`, never a label string, because this component will not
   * manufacture a button that does nothing.
   */
  action?: ReactNode;
  /** Secondary action, e.g. "Clear filters" beside "New shipment". */
  secondaryAction?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  tone = 'neutral',
  size = 'md',
  action,
  secondaryAction,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex min-w-0 flex-col items-center justify-center px-4 text-center',
        size === 'sm' ? 'py-8' : 'py-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mb-4 inline-flex items-center justify-center rounded-pill',
          size === 'sm' ? 'size-10' : 'size-12',
          TONE_CLASS[tone],
        )}
      >
        <Icon className={size === 'sm' ? 'size-5' : 'size-6'} />
      </span>

      <p
        className={cn(
          'max-w-prose font-semibold text-content text-balance',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </p>

      {description ? (
        <p
          className={cn(
            'mt-1 max-w-prose text-content-muted text-pretty',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
