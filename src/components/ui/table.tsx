import {
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, PackageSearch, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { cardLinkOverlayClass } from './card';

/**
 * TABLE
 * -----
 * An operations table for shipments, quotes, orders and drivers.
 *
 * THE RESPONSIVE PROBLEM, AND WHY THE OBVIOUS FIX IS WRONG
 * Six columns do not fit in 320px. The standard CSS trick is to set
 * `display: block` on the table, rows and cells below a breakpoint and lay
 * them out as cards. It is in every tutorial and it BREAKS THE SEMANTICS:
 * browsers compute an element's accessibility role from its layout
 * participation, and a `<table>` that is `display: block` is no longer
 * participating in table layout — so Chrome and Safari stop exposing it as a
 * table. The column headers vanish from the accessibility tree at exactly the
 * width where the user has the least context to begin with, and the table is
 * now worse for a screen-reader user on a phone than it is on a desktop.
 *
 * There is no `overflow-x: auto` fallback either. The brief is explicit and so
 * is WCAG 1.4.10 (reflow): a data table that scrolls sideways inside a phone
 * viewport hides most of its columns behind a swipe nobody discovers, and it is
 * the single most common way operational software becomes unusable in the
 * field. A driver's phone is a phone.
 *
 * SO: TWO LAYOUTS, ONE SOURCE OF TRUTH
 *   md and up  -> a real `<table>` with real `<th scope="col">` headers.
 *   below md   -> a `<ul>` of cards, one per row.
 * Both are rendered from the same `rows` array. Exactly one is visible at any
 * width because the other is `display: none` — and a `display: none` subtree
 * is removed from the accessibility tree, so a screen-reader user meets ONE
 * coherent structure, never two overlapping ones and never a mangled one. The
 * cost is one extra copy of the markup in the HTML payload; the benefit is that
 * neither viewport has to compromise. For a 25-row page that is a few
 * kilobytes, against shipping an unreadable table to every customer on mobile.
 *
 * `DataTable` hides the desktop table below `md` and the card list from `md` up.
 * The low-level `Table` / `TableRow` / `TableCell` primitives are exported for
 * a table that genuinely must be a table at every width (a comparison matrix,
 * a timetable) — pass them to the caller and they get a real table and their
 * own overflow problem to solve deliberately.
 *
 * SORTING IS SERVER-SIDE AND IS A LINK
 * `buildSortHref` produces a URL. `aria-sort` sits on the `<th>`, never on the
 * link, and only one column carries it at a time — two `aria-sort` values in
 * one table is a spec violation that makes assistive tech announce nonsense.
 * Sort controls do not appear in the card layout: below `md` they belong in
 * the filter bar above the list, where there is room for them.
 *
 * THE FIRST COLUMN IS THE ROW HEADER
 * Rendered as `<th scope="row">`. It is what lets a screen reader announce
 * "VC-8471-XXXX" as you move across the other cells, instead of a row of
 * unlabelled values.
 */

export type TableSort = { column: string; direction: 'asc' | 'desc' };

export type TableAlign = 'start' | 'end';

export type TableProps = HTMLAttributes<HTMLTableElement>;

/** A real `<table>`. `border-separate` + `border-spacing-0` keeps the row
 *  dividers flush with the rounded wrapper edge. */
export function Table({ className, ...rest }: TableProps) {
  return (
    <table
      {...rest}
      className={cn('w-full border-separate border-spacing-0 text-sm', className)}
    />
  );
}

export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

export function TableCaption({ className, ...rest }: TableCaptionProps) {
  return <caption {...rest} className={cn('sr-only', className)} />;
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>;

export function TableHead({ className, scope = 'col', ...rest }: TableHeadProps) {
  return (
    <th
      {...rest}
      scope={scope}
      className={cn(
        'border-b border-line bg-surface-muted px-4 py-3 text-left align-middle text-sm font-semibold text-content',
        className,
      )}
    />
  );
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function TableCell({ className, ...rest }: TableCellProps) {
  return (
    <td
      {...rest}
      className={cn('border-b border-line px-4 py-3 align-middle text-content', className)}
    />
  );
}

/** Tailwind `md:` prefix, so the two layouts switch at one width. */
const DESKTOP_ONLY = 'hidden md:block';
const MOBILE_ONLY = 'md:hidden';

export type DataTableColumn<T> = {
  /** Stable key. Also the sort key and the React key. */
  key: string;
  /** Column header content. */
  header: ReactNode;
  /**
   * Plain-text header, used to build the sort link's accessible name.
   * Required when the column is sortable and `header` is not a string.
   */
  headerText?: string;
  cell: (row: T, index: number) => ReactNode;
  align?: TableAlign;
  /**
   * Marks the row's identity. Rendered as `<th scope="row">` in the table and
   * as the card title below `md`. The first column defaults to true.
   */
  rowHeader?: boolean;
  /**
   * Moved into the card's `<dl>` detail list instead of sitting under the
   * title. Use for the values a user scans AFTER they know which row it is.
   */
  secondary?: boolean;
  /** Omitted from the card layout entirely. Never set this on the row header. */
  cardHide?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableProps<T> = {
  /**
   * The table's accessible name. REQUIRED — a screen-reader user reaches a
   * table through the landmark list and needs to know what it holds before
   * they enter it.
   */
  caption: string;
  /** Show the caption above the table instead of keeping it for AT only. */
  showCaption?: boolean;
  columns: DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  /** Initial load or refresh in flight. Renders the skeleton, never stale data. */
  loading?: boolean;
  /** How many skeleton rows to draw. Default 5 — roughly one screen. */
  loadingRows?: number;
  /** Rendered when there are no rows. Override with real, specific copy. */
  empty?: ReactNode;
  /** A recoverable failure. Renders with `role="alert"` and a retry slot. */
  error?: ReactNode;
  /** The retry control. A `ReactNode` so nothing here can be a dead button. */
  errorAction?: ReactNode;
  /** Current server-side sort. */
  sort?: TableSort | null;
  /** Builds the URL for a new sort. Required for a column to be sortable. */
  buildSortHref?: (column: string, direction: 'asc' | 'desc') => string;
  /** Row-level controls, permission-checked by the caller. */
  rowActions?: (row: T) => ReactNode;
  /** Makes the whole row navigate, via a stretched link on the row header. */
  rowHref?: (row: T) => string;
  className?: string;
}

function nextDirection(column: string, current: TableSort | null | undefined): 'asc' | 'desc' {
  if (current && current.column === column) {
    return current.direction === 'asc' ? 'desc' : 'asc';
  }
  return 'asc';
}

function sortLabel(
  headerText: string,
  column: string,
  current: TableSort | null | undefined,
): string {
  const target = nextDirection(column, current);
  if (!current || current.column !== column) {
    return `${headerText}, sort ${target === 'asc' ? 'ascending' : 'descending'}`;
  }
  const now =
    current.direction === 'asc' ? 'ascending, activate to sort descending' : 'descending, activate to sort ascending';
  return `${headerText}, sorted ${now}`;
}

export function DataTable<T>({
  caption,
  showCaption = false,
  columns,
  rows,
  rowKey,
  loading = false,
  loadingRows = 5,
  empty,
  error,
  errorAction,
  sort = null,
  buildSortHref,
  rowActions,
  rowHref,
  className,
}: DataTableProps<T>) {
  const sortable = Boolean(buildSortHref);

  // The first column is the row header unless a later one claims it.
  const withRowHeader = columns.map((column, index) => ({
    ...column,
    rowHeader: column.rowHeader ?? index === 0,
  }));

  const leadColumns = withRowHeader.filter((column) => !column.secondary);
  const detailColumns = withRowHeader.filter((column) => column.secondary);
  const hasActions = Boolean(rowActions);

  const alignClass = (align: TableAlign | undefined) => (align === 'end' ? 'text-right' : 'text-left');
  const cellAlign = (align: TableAlign | undefined) =>
    align === 'end' ? 'text-right tabular' : 'text-left';

  const errorState = !loading && error ? (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        tone="danger"
        title="This list could not be loaded"
        description="Nothing is lost — the request did not reach the server or the server could not answer. Check the connection and try again."
        action={errorAction}
      />
    </div>
  ) : null;

  const emptyState = !loading && !error ? (
    empty ?? (
      <EmptyState
        icon={PackageSearch}
        title="Nothing matches the current view"
        description="No records are here yet, or the filters in use exclude everything. Clearing a filter widens the search."
      />
    )
  ) : null;

  return (
    <div className={cn('min-w-0 overflow-hidden rounded-md border border-line bg-surface', className)}>
      {/*
        The live region sits OUTSIDE both layouts so exactly one announcement
        happens per state change rather than two. `role="status"` is polite:
        "loading" should queue behind whatever the screen reader is saying, not
        cut across a dispatcher mid-sentence.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {loading ? `Loading ${caption}` : null}
      </span>

      {/* ------------------------------------------------------------------ */}
      {/* md and up — a real table                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className={DESKTOP_ONLY}>
        <table className="w-full border-separate border-spacing-0 text-sm" aria-busy={loading || undefined}>
          <caption className={showCaption ? 'border-b border-line px-4 py-3 text-left text-sm text-content-muted' : 'sr-only'}>
            {caption}
          </caption>
          <thead>
            <tr>
              {withRowHeader.map((column) => {
                const isSorted = sort?.column === column.key;
                const ariaSort = !sortable
                  ? undefined
                  : isSorted
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';

                const SortIcon = isSorted
                  ? sort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'border-b border-line bg-surface-muted px-4 py-3 align-middle text-sm font-semibold text-content',
                      alignClass(column.align),
                      column.headerClassName,
                    )}
                  >
                    {sortable && buildSortHref ? (
                      <Link
                        href={buildSortHref(
                          column.key,
                          nextDirection(column.key, sort),
                        )}
                        scroll={false}
                        aria-label={
                          column.headerText
                            ? sortLabel(column.headerText, column.key, sort)
                            : undefined
                        }
                        className={cn(
                          '-mx-1 inline-flex min-h-11 items-center gap-1 rounded-sm px-1 md:min-h-9',
                          alignClass(column.align),
                          // Guarded by hand: Tailwind v4's `hover:` compiles to an
                          // unconditional rule, so on a phone the first tap would
                          // latch a row or a column header into its hover state
                          // and leave it looking selected. See card.tsx.
                          '[@media(hover:hover)]:bg-surface [@media(hover:hover)]:text-primary',
                        )}
                      >
                        {column.header}
                        {/*
                          Decorative. `aria-sort` on the <th> is what a screen
                          reader announces; an unlabelled arrow icon would add
                          nothing and could be read as content.
                        */}
                        <SortIcon
                          aria-hidden="true"
                          className={cn(
                            'size-3.5 shrink-0',
                            isSorted ? 'text-primary' : 'text-content-subtle',
                          )}
                        />
                      </Link>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {hasActions ? (
                <th scope="col" className="w-px border-b border-line bg-surface-muted px-4 py-3 text-right align-middle text-sm font-semibold text-content">
                  <span className="sr-only">Row actions</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: loadingRows }, (_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {withRowHeader.map((column) => (
                      <td key={column.key} className="border-b border-line px-4 py-3">
                        <Skeleton className={cn('h-4', column.rowHeader ? 'w-32' : 'w-20')} />
                      </td>
                    ))}
                    {hasActions ? (
                      <td className="border-b border-line px-4 py-3">
                        <Skeleton className="ms-auto h-4 w-8" />
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}

            {!loading && errorState ? (
              <tr>
                <td colSpan={withRowHeader.length + (hasActions ? 1 : 0)} className="p-0">
                  {errorState}
                </td>
              </tr>
            ) : null}

            {!loading && !error && emptyState ? (
              <tr>
                <td colSpan={withRowHeader.length + (hasActions ? 1 : 0)} className="p-0">
                  {emptyState}
                </td>
              </tr>
            ) : null}

            {!loading && !error
              ? rows.map((row, rowIndex) => (
                  <tr
                    key={rowKey(row, rowIndex)}
                    className="transition-colors duration-fast ease-enter [@media(hover:hover)]:bg-surface-muted"
                  >
                    {withRowHeader.map((column) => {
                      const content = column.cell(row, rowIndex);
                      if (column.rowHeader) {
                        return (
                          <th
                            key={column.key}
                            scope="row"
                            className={cn(
                              'border-b border-line px-4 py-3 text-left align-middle font-medium text-content',
                              column.cellClassName,
                            )}
                          >
                            {content}
                          </th>
                        );
                      }
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'border-b border-line px-4 py-3 align-middle text-content',
                            cellAlign(column.align),
                            column.cellClassName,
                          )}
                        >
                          {content}
                        </td>
                      );
                    })}
                    {hasActions ? (
                      <td className="border-b border-line px-4 py-3 text-right align-middle">
                        {rowActions ? rowActions(row) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* below md — one card per row                                          */}
      {/* ------------------------------------------------------------------ */}
      <ul className={cn(MOBILE_ONLY, 'divide-y divide-line')}>
        {loading
          ? Array.from({ length: loadingRows }, (_, rowIndex) => (
              <li key={`skeleton-${rowIndex}`} className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/3" />
              </li>
            ))
          : null}

        {!loading && errorState ? <li className="p-0">{errorState}</li> : null}
        {!loading && !error && emptyState ? <li className="p-0">{emptyState}</li> : null}

        {!loading && !error
          ? rows.map((row, rowIndex) => {
              const href = rowHref?.(row);
              const visibleLead = leadColumns.filter(
                (column) => !column.cardHide || column.rowHeader,
              );
              const visibleDetails = detailColumns.filter((column) => !column.cardHide);

              return (
                <li key={rowKey(row, rowIndex)} className="p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {visibleLead.map((column, columnIndex) => (
                        <div
                          key={column.key}
                          className={cn(
                            columnIndex === 0 ? 'text-sm' : 'mt-1 text-sm text-content-muted',
                          )}
                        >
                          {/*
                            The row header carries the stretched link when the
                            whole row navigates, so the card is ONE tab stop and
                            the link's text is what gets announced — instead of a
                            link whose accessible name is "click here".
                          */}
                          {column.rowHeader && href ? (
                            <Link
                              href={href}
                              className={cn('font-semibold text-content', cardLinkOverlayClass)}
                            >
                              {column.cell(row, rowIndex)}
                            </Link>
                          ) : (
                            column.cell(row, rowIndex)
                          )}
                        </div>
                      ))}
                    </div>

                    {/*
                      Row actions sit ABOVE the stretched link layer: the card
                      must be a container with `relative` for the overlay to
                      size correctly, and the actions must stay clickable.
                    */}
                    {hasActions ? (
                      <div className="relative z-10 flex shrink-0 items-center gap-1">
                        {rowActions ? rowActions(row) : null}
                      </div>
                    ) : null}
                  </div>

                  {visibleDetails.length > 0 ? (
                    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                      {visibleDetails.map((column) => (
                        <Fragment key={column.key}>
                          <dt className="text-xs text-content-muted">{column.header}</dt>
                          <dd
                            className={cn(
                              'min-w-0 text-sm text-content',
                              cellAlign(column.align),
                            )}
                          >
                            {column.cell(row, rowIndex)}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  ) : null}
                </li>
              );
            })
          : null}
      </ul>
    </div>
  );
}

/* ========================================================================== */
/* LOW-LEVEL PRIMITIVES                                                        */
/* A real table at every width. Use when a table must be a table on a phone    */
/* (a timetable, a comparison matrix) and accept that it needs a deliberate   */
/* container-level overflow strategy of its own.                               */
/* ========================================================================== */

export type TableContainerProps = HTMLAttributes<HTMLDivElement>;

export function TableContainer({ className, ...rest }: TableContainerProps) {
  return (
    <div
      {...rest}
      className={cn('min-w-0 overflow-x-auto rounded-md border border-line bg-surface', className)}
    />
  );
}

export type TableHeadSortProps = {
  children: ReactNode;
  /** Plain-text header, used for the link's accessible name. */
  label: string;
  column: string;
  sort?: TableSort | null;
  buildSortHref: (column: string, direction: 'asc' | 'desc') => string;
  className?: string;
};

/**
 * A standalone sortable header cell, for the low-level API. Same contract as
 * the one `DataTable` builds inline — kept here so the two cannot drift.
 */
export function TableHeadSort({
  children,
  label,
  column,
  sort = null,
  buildSortHref,
  className,
}: TableHeadSortProps) {
  const isSorted = sort?.column === column;
  const Icon = isSorted ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead
      aria-sort={
        isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn('p-0', className)}
    >
      <Link
        href={buildSortHref(column, nextDirection(column, sort))}
        scroll={false}
        aria-label={sortLabel(label, column, sort)}
        className="-mx-1 inline-flex min-h-11 items-center gap-1 rounded-sm px-1 [@media(hover:hover)]:bg-surface md:min-h-9"
      >
        {children}
        <Icon
          aria-hidden="true"
          className={cn('size-3.5 shrink-0', isSorted ? 'text-primary' : 'text-content-subtle')}
        />
      </Link>
    </TableHead>
  );
}
