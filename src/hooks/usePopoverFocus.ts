'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * True when a pointer press landed outside every given region. A press with no
 * target (or on a detached node) counts as outside; `null` regions are skipped.
 */
export function isOutsidePress<T>(
  target: T | null,
  regions: ReadonlyArray<{ contains: (node: T) => boolean } | null | undefined>,
): boolean {
  if (target === null) return true;
  return !regions.some((region) => region?.contains(target) === true);
}

/**
 * Whether closing an overlay should hand focus back to its opener. Focus is
 * only restored when it would otherwise be lost (on `<body>`, or on an element
 * inside the overlay that is about to go away); a user who has already moved
 * focus somewhere else on the page keeps it.
 */
export function shouldReturnFocus(state: {
  activeElement: unknown;
  body: unknown;
  containerContainsActive: boolean;
}): boolean {
  return (
    state.activeElement === null ||
    state.activeElement === undefined ||
    state.activeElement === state.body ||
    state.containerContainsActive
  );
}

export interface UsePopoverFocusOptions {
  /** Whether the popover / drawer is currently open. */
  open: boolean;
  /** The `role="dialog"` panel. Give it `tabIndex={-1}` so it can take focus. */
  containerRef: RefObject<HTMLElement | null>;
  /** The control that opens it; focus returns here on close. Defaults to whatever was focused on open. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Called for Escape and for outside presses. */
  onClose: () => void;
  /** Close on Escape. Defaults to true. */
  closeOnEscape?: boolean;
  /** Close when the pointer is pressed outside the panel and trigger. Defaults to true. */
  closeOnOutsidePress?: boolean;
  /** Move focus into the panel when it opens. Defaults to true. */
  focusOnOpen?: boolean;
}

/**
 * Keyboard and focus behaviour for non-modal popovers and floating panels
 * (notification centre, network health, assistant). Unlike {@link useFocusTrap}
 * it does not trap Tab or lock scrolling, because the page behind stays usable;
 * it makes sure keyboard users can get in, get out and land where they started:
 *
 * - Moves focus into the panel on open.
 * - Closes on Escape and on an outside press.
 * - Returns focus to the trigger on close, unless the user already moved it.
 */
export function usePopoverFocus({
  open,
  containerRef,
  triggerRef,
  onClose,
  closeOnEscape = true,
  closeOnOutsidePress = true,
  focusOnOpen = true,
}: UsePopoverFocusOptions): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const container = containerRef.current;
    const trigger = triggerRef?.current ?? null;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // A panel that is still fading in from `visibility: hidden` cannot take
    // focus on the very first frame, so try once more on the next one.
    let retryFrame = 0;
    if (focusOnOpen && container) {
      container.focus({ preventScroll: true });
      if (document.activeElement !== container) {
        retryFrame = window.requestAnimationFrame(() => {
          container.focus({ preventScroll: true });
        });
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') onCloseRef.current();
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!closeOnOutsidePress) return;
      const target = event.target instanceof Node ? event.target : null;
      if (isOutsidePress<Node>(target, [container, trigger])) {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.cancelAnimationFrame(retryFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);

      const returnTarget = trigger ?? opener;
      if (
        returnTarget &&
        returnTarget !== document.body &&
        document.contains(returnTarget) &&
        shouldReturnFocus({
          activeElement: document.activeElement,
          body: document.body,
          containerContainsActive: Boolean(container?.contains(document.activeElement)),
        })
      ) {
        returnTarget.focus({ preventScroll: true });
      }
    };
  }, [open, containerRef, triggerRef, closeOnEscape, closeOnOutsidePress, focusOnOpen]);
}
