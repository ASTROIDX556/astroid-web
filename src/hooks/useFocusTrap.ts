'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Keyboard-accessible focus management for modals, drawers and overlays.
 *
 * Implements the WAI-ARIA dialog pattern (WCAG 2.1 AA):
 * - Tab / Shift+Tab cycle through the focusable elements inside the container.
 *   If focus has drifted outside (e.g. after a mouse click on static copy) the
 *   next Tab pulls it back before the browser tab order can run over the page.
 * - Escape dismisses the surface.
 * - Focus moves into the container when it opens (to `initialFocus` when given,
 *   otherwise to the container itself) and is restored to the previously
 *   focused trigger on close if that node is still mounted.
 * - Optional body scroll lock while the trap is active.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** True for elements that can actually receive keyboard focus right now. */
export function isKeyboardFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

export type FocusTarget = RefObject<HTMLElement | null> | (() => HTMLElement | null);

export interface UseFocusTrapOptions {
  /** Whether the trap is currently engaged. */
  active: boolean;
  /** Container that owns the trapped tab cycle. */
  containerRef: RefObject<HTMLElement | null>;
  /** Called when Escape is pressed (and `closeOnEscape` is true). */
  onEscape?: () => void;
  /** Element to focus when the trap engages; defaults to the container. */
  initialFocus?: FocusTarget;
  /** Lock `document.body` scrolling while active. Defaults to `true`. */
  lockScroll?: boolean;
  /** Restore focus to the pre-open trigger on close. Defaults to `true`. */
  restoreFocus?: boolean;
  /** Dismiss on Escape. Defaults to `true`. */
  closeOnEscape?: boolean;
  /** Pull stray focus back into the container. Defaults to `true`. */
  trapFocus?: boolean;
}

function resolveFocusTarget(target: FocusTarget | undefined): HTMLElement | null {
  if (!target) return null;
  if (typeof target === 'function') return target();
  return target.current;
}

export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  initialFocus,
  lockScroll = true,
  restoreFocus = true,
  closeOnEscape = true,
  trapFocus = true,
}: UseFocusTrapOptions): void {
  // Keep the latest callbacks/targets without re-running the effect (and
  // re-capturing the trigger) on every parent re-render.
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);
  useEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRef.current = initialFocus;
  }, [onEscape, initialFocus]);

  useEffect(() => {
    if (!active) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    const trigger = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        isKeyboardFocusable,
      );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!closeOnEscape) return;
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }

      if (!trapFocus || event.key !== 'Tab') return;

      const focusables = getFocusables();
      if (focusables.length === 0) {
        // Nothing focusable inside: keep focus pinned to the container itself.
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeEl = document.activeElement;

      if (!container.contains(activeEl)) {
        // Focus drifted outside the surface — pull it back in before the
        // browser tab order can walk over the background page.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (activeEl === first || activeEl === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!trapFocus) return;
      const target = event.target as Node | null;
      if (target && container.contains(target)) return;
      const focusables = getFocusables();
      (focusables[0] ?? container).focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    if (trapFocus) document.addEventListener('focusin', onFocusIn);

    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';

    const focusTarget = resolveFocusTarget(initialFocusRef.current);
    (focusTarget ?? container).focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      if (lockScroll) document.body.style.overflow = previousOverflow;

      // Restore focus to the trigger only when it is still in the document
      // (it may have unmounted with the panel that housed it).
      if (
        restoreFocus &&
        trigger &&
        trigger !== document.body &&
        document.contains(trigger)
      ) {
        trigger.focus();
      }
    };
  }, [active, containerRef, lockScroll, restoreFocus, closeOnEscape, trapFocus]);
}

export default useFocusTrap;
