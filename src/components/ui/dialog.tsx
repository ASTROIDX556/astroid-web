'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** True for elements that can actually receive keyboard focus right now. */
function isKeyboardFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

/**
 * Accessible modal dialog: portal, focus trap, Escape + overlay dismissal.
 * The panel is exposed as `role="dialog" aria-modal="true"` with
 * `aria-labelledby`/`aria-describedby` pointing at the title/description.
 *
 * Keyboard behaviour (WCAG 2.1 AA):
 * - Tab/Shift+Tab cycle only through enabled, visible focusables inside the
 *   panel; if focus has drifted outside (e.g. after clicking static text),
 *   the next Tab is pulled back into the dialog instead of leaking to the
 *   background page.
 * - Escape dismisses; the overlay click dismisses; body scrolling is locked.
 * - On open, focus moves to the dialog panel; on close, focus is restored to
 *   the element that was focused before opening (the trigger), if it is still
 *   in the document.
 * The trap effect depends only on `open` — an unstable `onClose` callback no
 * longer tears down and re-establishes the listener (which used to re-capture
 * the trigger and steal focus back to the panel on every parent re-render).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  // Keep the latest onClose in a ref so the trap effect below can depend on
  // `open` alone. Consumers almost always pass a fresh inline arrow per
  // render; re-running the effect on every render would re-capture
  // `document.activeElement` (now inside the dialog), steal focus back to the
  // panel mid-typing, and restore focus to a stale element on cleanup.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Track mount separately from `open` so the portal target exists before the
  // first render that needs it (React portals require an existing DOM node).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Re-render once mounted so an open dialog actually portals on the client.
  const [, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    // Captured exactly once per open transition: the element focused before
    // the dialog appeared (its trigger).
    triggerRef.current = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter(isKeyboardFocusable);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusables();
      if (focusables.length === 0) {
        // Nothing focusable inside: keep focus pinned to the panel itself.
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (!panel.contains(active)) {
        // Focus drifted outside the dialog (clicked static text, moved via
        // browser UI, opened on a page where focus was elsewhere). Pull it
        // back in before the tab order can run over the background page.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger on close, but only if it is still in
      // the document (it may have unmounted with the panel that housed it).
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger && trigger !== document.body && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [open]);

  // `isClient` guards the SSR pass; `mounted` must already be true when `open`
  // is first set because the component is rendered inside a client tree.
  if (!open || !mounted.current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full animate-fade-up rounded-dialog border border-border bg-surface shadow-soft-3 focus:outline-none',
          sizeClass[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-2">
          <div className="flex flex-col gap-1">
            {title && (
              <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="text-xs text-foreground-secondary">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="p-6 pt-2">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border p-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
