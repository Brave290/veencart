'use client';

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { buttonVariants } from './button';

/**
 * DIALOG
 * ------
 * An accessible modal. Everything below is a WCAG requirement, not polish —
 * each of these has been the cause of a real bug in a real product.
 *
 *   1. FOCUS IS TRAPPED. Tab from the last control cycles to the first and
 *      Shift+Tab from the first cycles to the last. Without this, a keyboard
 *      user tabs into the page BEHIND the dialog and has no idea a modal
 *      exists.
 *   2. ESCAPE CLOSES. Unconditional.
 *   3. FOCUS RETURNS TO THE TRIGGER. This is the one everybody forgets. Close a
 *      dialog and the focus falls back to <body>, so the next Tab restarts at
 *      the top of the page — on a staff console that is thirty tabs. The
 *      trigger element is captured from the click event's `currentTarget`
 *      rather than from `document.activeElement`, because Safari does NOT
 *      focus a <button> on click and the fallback would be <body>.
 *   4. BODY SCROLL IS LOCKED, with the scrollbar width added back as padding so
 *      the page behind does not jump sideways as the scrollbar disappears.
 *   5. aria-modal="true" plus title and description references, so a screen
 *      reader says what the dialog is before the user explores it.
 *
 * WHY NOT THE NATIVE <dialog> ELEMENT
 * `showModal()` gives focus containment, Esc and a top layer, but it does not
 * return focus, it gives no hook for a backdrop click that cannot fire on a
 * drag-out, and `::backdrop` cannot be styled from a component file here. The
 * hand-rolled version is longer but every behaviour above is explicit.
 *
 * REDUCED MOTION ESCAPE HATCH
 * The panel and backdrop use `animate-fade-in-up` / `animate-overlay-in` with
 * a `both` fill, and both globals.css and motion.css collapse animation
 * durations to 0.01ms under `prefers-reduced-motion: reduce`. The element
 * lands on its final frame instantly rather than sitting at `opacity: 0`
 * waiting for an animation that never runs. The panel is only ever in the DOM
 * while the dialog is open, so there is no state in which it can be stuck
 * invisible.
 *
 * MOBILE SHAPE
 * A bottom sheet below `sm`, a centred dialog from `sm` up. Centring lives on
 * a WRAPPER element, not on the panel, because the entrance keyframes animate
 * `transform` and an animation with `both` fill would overwrite a
 * `translate(-50%, -50%)` and drop the panel into the top-left corner.
 */

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  hasDescription: boolean;
  setHasDescription: (has: boolean) => void;
  /**
   * Records the element that opened the dialog so focus can be sent back to
   * it on close, and reads it back from inside the open effect.
   *
   * Two callbacks rather than the ref itself. A ref handed around through
   * context can be read at a moment when React is rendering and its value is
   * not yet committed; behind a pair of functions the ref is only ever touched
   * inside an event handler or inside an effect, which is the rule that keeps
   * focus restoration predictable.
   */
  registerTrigger: (element: HTMLElement) => void;
  readTrigger: () => HTMLElement | null;
  closeOnBackdropClick: boolean;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(`<${component}> must be rendered inside <Dialog>.`);
  }
  return context;
}

/** Props `DialogTrigger` injects into its child element. */
type TriggerChildProps = {
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
};

/** Props `DialogClose` injects into its child element. */
type CloseChildProps = {
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  type?: 'button' | 'submit' | 'reset';
};

export type DialogProps = {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Set false for a dialog whose work would be lost on a stray tap — a
   * half-entered dispatch note, an unsaved address.
   */
  closeOnBackdropClick?: boolean;
};

/**
 * Owns open state and the ids that connect the panel to its title and
 * description. Renders no DOM of its own.
 */
export function Dialog({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  closeOnBackdropClick = true,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [hasDescription, setHasDescription] = useState(false);
  const reactId = useId();
  const triggerElRef = useRef<HTMLElement | null>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const registerTrigger = useCallback((element: HTMLElement) => {
    triggerElRef.current = element;
  }, []);

  const readTrigger = useCallback(() => triggerElRef.current, []);

  const value = useMemo<DialogContextValue>(
    () => ({
      open: isOpen,
      setOpen,
      titleId: `${reactId}-title`,
      descriptionId: `${reactId}-description`,
      hasDescription,
      setHasDescription,
      registerTrigger,
      readTrigger,
      closeOnBackdropClick,
    }),
    [isOpen, setOpen, reactId, hasDescription, registerTrigger, readTrigger, closeOnBackdropClick],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

/**
 * DialogTrigger — wraps ONE interactive element (a `Button`, a `<button>`, an
 * `<a>`). It is cloned, never wrapped: a wrapper `<span>` around a `<button>`
 * is harmless, but a wrapper around a link inside a button is a nested
 * interactive violation that assistive tech and validators both flag.
 *
 * The child's own `onClick` runs FIRST so it can call `preventDefault()` to
 * veto the open. That is the escape hatch, and it costs one prop.
 */
export type DialogTriggerProps = {
  children: ReactElement<TriggerChildProps>;
};

export function DialogTrigger({ children }: DialogTriggerProps) {
  const { open, setOpen, titleId, registerTrigger } = useDialogContext('DialogTrigger');

  const child = isValidElement<TriggerChildProps>(children) ? children : null;

  // One stable handler. Built with `useCallback` rather than inline so the
  // closure that writes the trigger element is created once, outside render.
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      child?.props.onClick?.(event);
      if (event.defaultPrevented) return;
      // `currentTarget` is the real DOM node this handler is attached to and,
      // unlike `document.activeElement`, it is populated on Safari too — Safari
      // does not focus a <button> on click, so the usual fallback would be
      // <body> and focus would be lost to the top of the page on close.
      registerTrigger(event.currentTarget);
      setOpen(true);
    },
    [child, registerTrigger, setOpen],
  );

  if (child === null) {
    throw new Error(
      '<DialogTrigger> expects one interactive element child, e.g. <DialogTrigger><Button>Open</Button></DialogTrigger>.',
    );
  }

  return cloneElement(child, {
    onClick: handleClick,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': titleId,
  });
}

/**
 * Selectable descendants of the panel. `[tabindex]:not([tabindex="-1"])` is
 * appended so a custom widget still participates in the trap even when it is
 * not one of the native controls.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Focusable elements inside `container`, in DOM order.
 *
 * `getClientRects()` rather than `offsetParent`: `offsetParent` is null for
 * every `position: fixed` element and the panel is fixed, so the offsetParent
 * test would report the dialog as containing nothing focusable and the trap
 * would collapse.
 */
function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

export type DialogContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * The panel and its backdrop, portalled to <body> so no ancestor
 * `overflow: hidden` or `transform` can clip it.
 */
export function DialogContent({ children, className, ...rest }: DialogContentProps) {
  const {
    open,
    setOpen,
    closeOnBackdropClick,
    titleId,
    descriptionId,
    hasDescription,
    readTrigger,
  } = useDialogContext('DialogContent');

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Held in a ref so the open/close effect has no dependencies. An inline
  // `onOpenChange={() => setOpen(false)}` would otherwise re-run that effect on
  // every parent render, re-striking focus to the top of the dialog
  // mid-interaction — the classic "my dialog keeps jumping back" bug.
  const closeRef = useRef(setOpen);
  useEffect(() => {
    closeRef.current = setOpen;
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    // A dialog opened without a `DialogTrigger` — controlled from somewhere
    // else — still gets somewhere sensible to send focus back to.
    const previouslyFocused =
      readTrigger() ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Lock the page behind. The padding compensation keeps the layout from
    // shifting right as the scrollbar disappears — a jump that reads as a
    // glitch and, on a modal, looks like the page moved under the user.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPadding =
        Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    // Focus the first control, or the panel itself. The panel carries
    // tabIndex -1 precisely so this fallback works: a dialog with nothing
    // focusable in it (a read-only confirmation) still takes focus, so Escape
    // and Tab reach the handler and the screen reader starts inside it.
    const initial = focusableWithin(panel)[0] ?? panel;
    initial.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableWithin(panel);
      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (firstItem === undefined || lastItem === undefined) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const active = document.activeElement;

      if (event.shiftKey && (active === firstItem || !panel.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    // Capture phase: beats any handler a consumer attached further up, so a
    // stray Escape cannot be swallowed before the dialog sees it.
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, readTrigger]);

  // `createPortal` needs `document`. A render-time environment check rather
  // than a `useEffect` + `setState` mounted flag: the flag costs a cascading
  // render on every mount and still has to be paired with a check. A dialog
  // that is open during SSR is a genuinely unusual case, and returning null
  // for it is the correct degradation.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/*
        The backdrop is a layer UNDER the panel, so `mousedown` here can only
        fire from a genuine tap on empty space. There is no handler on the
        panel itself, so a drag that starts on the header and releases over
        the backdrop cannot dismiss the dialog and lose what was being typed.
      */}
      <div
        aria-hidden="true"
        onMouseDown={closeOnBackdropClick ? () => closeRef.current(false) : undefined}
        className="animate-overlay-in absolute inset-0 bg-content/50"
      />

      {/* Centring lives here, not on the panel — see the header comment. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center sm:inset-0 sm:items-center sm:p-4">
        <div
          {...rest}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={hasDescription ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            'animate-fade-in-up flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-lg bg-surface shadow-dialog',
            'sm:max-h-[85dvh] sm:max-w-lg sm:rounded-lg',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type DialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...rest }: DialogHeaderProps) {
  return (
    <div
      {...rest}
      className={cn('flex items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-5', className)}
    />
  );
}

export type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

/**
 * Gives the panel its accessible name through `aria-labelledby`. Render
 * exactly one per dialog — an unlabelled modal is a dead end for a screen
 * reader user.
 */
export function DialogTitle({ className, ...rest }: DialogTitleProps) {
  const { titleId } = useDialogContext('DialogTitle');
  return (
    <h2
      {...rest}
      id={titleId}
      className={cn('text-base font-semibold text-content', className)}
    />
  );
}

export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/**
 * Optional. Registers itself so `DialogContent` can point `aria-describedby`
 * at a node that exists. A dangling IDREF is ignored by the spec, but the
 * description is read out after the title on every open, so it is worth being
 * certain it is wired.
 */
export function DialogDescription({ className, ...rest }: DialogDescriptionProps) {
  const { descriptionId, setHasDescription } = useDialogContext('DialogDescription');

  useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <p
      {...rest}
      id={descriptionId}
      className={cn('mt-1 text-sm text-content-muted', className)}
    />
  );
}

export type DialogBodyProps = HTMLAttributes<HTMLDivElement>;

export function DialogBody({ className, ...rest }: DialogBodyProps) {
  return (
    <div
      {...rest}
      className={cn(
        // `min-h-0` lets this flex child actually shrink. Without it a long
        // form refuses to scroll and pushes the footer off the panel.
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5',
        className,
      )}
    />
  );
}

export type DialogFooterProps = HTMLAttributes<HTMLDivElement>;

export function DialogFooter({ className, ...rest }: DialogFooterProps) {
  return (
    <div
      {...rest}
      className={cn(
        // Stacked on a phone so the primary action sits under the thumb at the
        // bottom of the sheet; inline and right-aligned from `sm` up. DOM order
        // stays Cancel then Confirm, which is what a screen reader reads.
        'flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5',
        className,
      )}
    />
  );
}

/**
 * The header's close control: a real `<button>`, 44x44 on mobile, with a
 * visible name. An icon-only control with no name is invisible to a screen
 * reader, and "the X" is not a name.
 */
export type DialogCloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Overridable so a specific dialog can say something more useful. */
  'aria-label'?: string;
};

export function DialogCloseButton({
  className,
  'aria-label': ariaLabel = 'Close dialog',
  type = 'button',
  onClick,
  ...rest
}: DialogCloseButtonProps) {
  const { setOpen } = useDialogContext('DialogCloseButton');

  return (
    <button
      {...rest}
      type={type}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setOpen(false);
      }}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm', iconOnly: true }), className)}
    >
      <X aria-hidden="true" className="size-5" />
    </button>
  );
}

export type DialogCloseProps = {
  children: ReactElement<CloseChildProps>;
};

/**
 * Closes the dialog when its child is activated — the Cancel button in a
 * confirmation footer. The child's own `onClick` still runs first so it can
 * veto the close with `preventDefault()`.
 */
export function DialogClose({ children }: DialogCloseProps) {
  const { setOpen } = useDialogContext('DialogClose');

  const child = isValidElement<CloseChildProps>(children) ? children : null;

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      child?.props.onClick?.(event);
      if (event.defaultPrevented) return;
      setOpen(false);
    },
    [child, setOpen],
  );

  if (child === null) {
    throw new Error(
      '<DialogClose> expects one element child, e.g. <DialogClose><Button>Cancel</Button></DialogClose>.',
    );
  }

  return cloneElement(child, {
    type: child.props.type ?? 'button',
    onClick: handleClick,
  });
}
