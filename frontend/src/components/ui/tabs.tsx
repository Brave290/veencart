'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

/**
 * TABS
 * ----
 * The WAI-ARIA tabs pattern, followed exactly, because the shortcuts are what
 * make it usable and they are not discoverable:
 *
 *   - ROVING TABINDEX. Only the selected tab is in the page tab order. A
 *     tablist with four tabs that all take a Tab stop costs the user four
 *     presses to move past a control that behaves like one.
 *   - ARROW KEYS MOVE, Tab exits. Left/Right for a horizontal strip,
 *     Up/Down for a vertical one, Home and End for the ends. That is the
 *     contract users learn from every other tab widget on the platform, and
 *     breaking it makes the component feel broken.
 *   - AUTOMATIC ACTIVATION by default: arrowing to a tab selects it. This is
 *     correct when a panel is cheap to render — a filter panel, a summary.
 *     `activationMode="manual"` moves focus without selecting, for a panel
 *     that costs a network request. Arrow navigation still works in manual
 *     mode; only the selection waits for Enter or Space.
 *   - DISABLED TABS ARE SKIPPED, not landed on.
 *
 * `TabsList` REQUIRES `aria-label` or `aria-labelledby` at the type level. A
 * tablist with no name is a landmark a screen-reader user can reach and not
 * identify — they hear "tab" and nothing about what the tabs are for.
 *
 * 320px
 * Tab strips are the most common source of horizontal overflow in this app
 * ("Awaiting quote · Quoted · Accepted · Picked up"). Below `sm` the strip
 * scrolls inside its own container — a deliberate, bounded container scroll,
 * never the page. From `sm` up it wraps and no scroll is needed. `overscroll-
 * x-contain` stops the scroll chaining into the page behind it.
 */

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: 'horizontal' | 'vertical';
  activationMode: 'automatic' | 'manual';
  listRef: React.RefObject<HTMLDivElement | null>;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  }
  return context;
}

export type TabsProps = {
  children: ReactNode;
  /** Controlled selected value. */
  value?: string;
  /** Initial selected value when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  className?: string;
};

export function Tabs({
  children,
  value,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
  className,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);

  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolledValue;

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const context = useMemo<TabsContextValue>(
    () => ({ value: current, setValue, baseId, orientation, activationMode, listRef }),
    [current, setValue, baseId, orientation, activationMode],
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={cn('min-w-0', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsListProps = HTMLAttributes<HTMLDivElement> &
  (
    | { 'aria-label': string; 'aria-labelledby'?: never }
    | { 'aria-label'?: never; 'aria-labelledby': string }
  );

export function TabsList({ className, onKeyDown, ...rest }: TabsListProps) {
  const { orientation, activationMode, setValue, listRef } = useTabsContext('TabsList');

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const isNext = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const isPrevious = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

    const handled =
      event.key === isNext ||
      event.key === isPrevious ||
      event.key === 'Home' ||
      event.key === 'End';
    if (!handled) return;

    const list = listRef.current;
    if (!list) return;

    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).filter(
      (tab) => !tab.disabled,
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex: number;
    switch (event.key) {
      case isNext:
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case isPrevious:
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      default:
        nextIndex = tabs.length - 1;
        break;
    }

    const nextTab = tabs[nextIndex];
    if (!nextTab) return;

    // The browser's own scroll-into-view fights ours on a scrolling strip, so
    // it is suppressed and focus() does the scrolling.
    event.preventDefault();
    nextTab.focus();

    // Manual mode defers the SELECTION but not the focus — that is the whole
    // point of it: the user sees where they are before the expensive panel
    // loads. Vertical strips activate on arrow even in manual mode, which is
    // what the APG specifies (the arrows double as the movement keys).
    const shouldActivate =
      activationMode === 'automatic' || orientation === 'vertical' || event.key === 'Home' || event.key === 'End';
    if (shouldActivate) {
      const nextValue = nextTab.dataset.value;
      if (nextValue !== undefined) setValue(nextValue);
    }
  };

  return (
    <div
      {...rest}
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex min-w-0 gap-1 border-b border-line',
        orientation === 'vertical' ? 'flex-col items-stretch' : 'flex-row',
        // Container-level scroll below `sm`, wrap above it. The page itself
        // never scrolls sideways.
        orientation === 'horizontal' &&
          'flex-nowrap overflow-x-auto overscroll-x-contain sm:flex-wrap sm:overflow-x-visible',
        className,
      )}
    />
  );
}

export type TabsTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  value: string;
  disabled?: boolean;
};

/**
 * A real `<button>` with `role="tab"`. Never a div: the Enter and Space keys,
 * the disabled semantics and the form participation all come free from the
 * native element.
 */
export function TabsTrigger({ value, className, disabled, onClick, ...rest }: TabsTriggerProps) {
  const { value: selected, setValue, baseId } = useTabsContext('TabsTrigger');
  const isSelected = value === selected;

  return (
    <button
      {...rest}
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`${baseId}-panel-${value}`}
      // Roving tabindex: one stop for the whole strip.
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      data-value={value}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        setValue(value);
      }}
      className={cn(
        // 44px on mobile, dense from `sm`. `border-b-2` on EVERY tab so the
        // strip height does not change when the selection moves.
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap',
        'transition-colors duration-fast ease-enter',
        isSelected
          ? 'border-primary text-content'
          : 'border-transparent text-content-muted hover:border-line hover:text-content',
        disabled && 'cursor-not-allowed text-content-disabled hover:border-transparent',
        className,
      )}
    />
  );
}

export type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

/**
 * `tabIndex={0}` because a panel can contain more content than fits and the
 * keyboard has to be able to scroll it. That costs one tab stop and saves a
 * keyboard user being unable to read a long panel.
 */
export function TabsContent({ value, className, children, ...rest }: TabsContentProps) {
  const { value: selected, baseId } = useTabsContext('TabsContent');
  const isSelected = value === selected;

  return (
    <div
      {...rest}
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      hidden={!isSelected}
      className={cn(!isSelected && 'hidden', 'py-4 focus-visible:rounded-sm', className)}
    >
      {children}
    </div>
  );
}
