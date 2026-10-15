import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';
import { buttonVariants } from './button';

/**
 * PAGINATION
 * ----------
 * Server-side. It renders LINKS, not buttons that fetch.
 *
 * WHY LINKS ARE NOT A SHORTCUT, THEY ARE THE FEATURE
 *   1. Middle-click and "open in new tab" work, because it is a real URL.
 *   2. It works before the JavaScript bundle has loaded. A staff dispatcher on
 *      a patchy 3G connection in a Lagos warehouse clicks "next" and it
 *      navigates; with a fetch-on-click button it waits for a bundle.
 *   3. The back button behaves. A driver who pages back through their route
 *      and hits back expects page 4, not page 1.
 *   4. It is crawlable and shareable, so a dispatcher can send a colleague a
 *      link to "the failed deliveries, newest first".
 *
 * FILTERS CANNOT BE LOST, AND THAT IS STRUCTURAL
 * The usual bug is a `href={`?page=${n}`}` that silently drops `?status=exception`
 * and lands the dispatcher on an unfiltered page 4 that looks empty and wrong.
 * This component does not take a `buildHref` callback, because a callback is
 * just a request to be trusted. It takes the CURRENT `searchParams` and
 * rewrites exactly one key — the page — leaving every filter, sort and tab in
 * place by construction. The only way to lose a filter here is to not pass it.
 *
 * THE COUNT IS ONLY SHOWN WHEN IT IS KNOWN
 * `totalItems` is `number | null` and `null` is a real answer meaning "the
 * server did not return a total". In that case no count is rendered, no page
 * numbers are invented, and Next is driven by `hasNextPage`. A pagination
 * control that says "Showing 1–20 of 20" when there are 4,000 rows is worse
 * than no pagination at all: the operator stops trusting it.
 */

export type PaginationParams = Record<string, string | string[] | undefined>;

export type SortDirection = 'asc' | 'desc';

export type PaginationProps = {
  /** Current page, 1-based. */
  page: number;
  /**
   * Total pages when the server knows it. Otherwise leave it null and supply
   * `totalItems` + `pageSize`, or `hasNextPage`.
   */
  pageCount?: number | null;
  /** Total matching rows, or null when the count was not run. */
  totalItems?: number | null;
  pageSize?: number;
  /**
   * Only consulted when the page count is unknown. Set it to
   * `rows.length === pageSize` — a full page means there is probably another.
   */
  hasNextPage?: boolean;
  /** The current URL's search params. THIS is what preserves the filters. */
  params?: PaginationParams;
  /** Path of the current route. Empty string keeps the component route-agnostic. */
  basePath?: string;
  /** Query key for the page number. */
  pageParam?: string;
  /** Plural noun for the record type, used in the result count. */
  itemLabel?: string;
  /** Pages shown either side of the current one, from `sm` up. */
  siblingCount?: number;
  /** Set while a navigation is in flight. Disables the links and sets aria-busy. */
  busy?: boolean;
  className?: string;
};

const COUNT_FORMAT = new Intl.NumberFormat('en-NG');

/**
 * Rebuilds the query string from the CURRENT params, replacing only `key`.
 * Array values are re-appended in order so a multi-select filter survives.
 */
function buildHref(
  basePath: string,
  params: PaginationParams,
  key: string,
  value: string,
): string {
  const search = new URLSearchParams();

  for (const [name, raw] of Object.entries(params)) {
    if (name === key) continue;
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const item of raw) search.append(name, item);
    } else {
      search.append(name, raw);
    }
  }
  search.set(key, value);

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** `null` marks an ellipsis. `1` and `last` are always present. */
function pageWindow(current: number, last: number, siblings: number): Array<number | null> {
  if (last <= 1) return [1];

  const window = new Set<number>([1, last]);
  for (let page = current - siblings; page <= current + siblings; page += 1) {
    if (page >= 1 && page <= last) window.add(page);
  }

  const sorted = [...window].sort((a, b) => a - b);
  const result: Array<number | null> = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous !== 0 && page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }
  return result;
}

/**
 * A disabled boundary control.
 *
 * Deliberately a `<span>`, not a `<button disabled>` or an `<a>` with no href.
 * A disabled control has nothing to do, so it should not be in the tab order —
 * and an anchor without `href` is not a link at all, so labelling it
 * `aria-disabled` would be describing something that does not exist. It keeps
 * the boundary marker so the user can still see they are at the first or last
 * page, and carries `aria-disabled` so a screen reader that lands on it says so.
 */
function DisabledStep({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span aria-disabled="true" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}>
      {children}
    </span>
  );
}

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  hasNextPage = false,
  params = {},
  basePath = '',
  pageParam = 'page',
  itemLabel = 'results',
  siblingCount = 1,
  busy = false,
  className,
}: PaginationProps) {
  const resolvedPageCount =
    pageCount ?? (totalItems !== null && totalItems !== undefined && pageSize ? Math.ceil(totalItems / pageSize) : null);

  const lastPage = resolvedPageCount !== null && resolvedPageCount !== undefined ? resolvedPageCount : null;
  const knownCount = totalItems !== null && totalItems !== undefined;

  const canGoPrevious = page > 1;
  const canGoNext = lastPage !== null ? page < lastPage : hasNextPage;

  // A single page with nothing to move between is not a control, it is noise.
  const hasAnythingToDo = canGoPrevious || canGoNext || (lastPage !== null && lastPage > 1);
  if (!hasAnythingToDo) return null;

  const firstItem = knownCount ? (page - 1) * (pageSize ?? 0) + 1 : null;
  const lastItem =
    knownCount && pageSize !== undefined ? Math.min(page * pageSize, totalItems ?? 0) : null;

  const linkClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    // The links are inside a <nav>; no underline is wanted, but `Link` inherits
    // nothing from the button recipe.
    'no-underline',
  );

  const currentLinkClass = cn(
    buttonVariants({ variant: 'primary', size: 'sm' }),
    'pointer-events-none',
  );

  return (
    <nav
      aria-label="Pagination"
      aria-busy={busy || undefined}
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3',
        busy && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {/*
        The result count. Rendered only when the count is actually known — see
        the header comment. `aria-live` is polite because the page number
        changing under a screen-reader user is exactly the change worth
        announcing, politely, after they finish what they were reading.
      */}
      <p aria-live="polite" className="order-2 w-full text-xs text-content-muted sm:order-1 sm:w-auto">
        {knownCount && pageSize !== undefined && firstItem !== null && lastItem !== null ? (
          <>
            Showing <span className="tabular">{COUNT_FORMAT.format(firstItem)}</span>–
            <span className="tabular">{COUNT_FORMAT.format(lastItem)}</span> of{' '}
            <span className="tabular">{COUNT_FORMAT.format(totalItems ?? 0)}</span>{' '}
            {itemLabel}
          </>
        ) : lastPage !== null ? (
          <>
            Page <span className="tabular">{page}</span> of{' '}
            <span className="tabular">{lastPage}</span>
          </>
        ) : (
          <>
            Page <span className="tabular">{page}</span>
          </>
        )}
      </p>

      <ul
        className={cn(
          'order-1 flex w-full min-w-0 items-center gap-1 sm:order-2 sm:w-auto',
          // Below `sm` the page-number strip is hidden. "1 2 3 4 5 … 48" does not
          // fit in 320px and squeezing it produces a control nobody can hit.
          // Prev / Next / "Page 4" cover the same ground at that width.
          'hidden sm:flex',
        )}
      >
        {pageWindow(page, lastPage ?? 1, siblingCount).map((entry, index) =>
          entry === null ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-sm leading-none text-content-subtle"
            >
              …
            </li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span aria-current="page" className={currentLinkClass}>
                  <span className="tabular">{entry}</span>
                </span>
              ) : (
                <Link
                  href={buildHref(basePath, params, pageParam, String(entry))}
                  scroll={false}
                  className={linkClass}
                  aria-label={`Go to page ${entry}`}
                >
                  <span className="tabular">{entry}</span>
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      <div className="order-3 flex items-center gap-2">
        {canGoPrevious ? (
          <Link
            href={buildHref(basePath, params, pageParam, String(page - 1))}
            scroll={false}
            rel="prev"
            className={linkClass}
          >
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            Previous
          </Link>
        ) : (
          <DisabledStep className="text-content-disabled">
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            Previous
          </DisabledStep>
        )}

        {canGoNext ? (
          <Link
            href={buildHref(basePath, params, pageParam, String(page + 1))}
            scroll={false}
            rel="next"
            className={linkClass}
          >
            Next
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        ) : (
          <DisabledStep className="text-content-disabled">
            Next
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          </DisabledStep>
        )}
      </div>
    </nav>
  );
}
