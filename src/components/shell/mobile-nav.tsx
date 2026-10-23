'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { navSections } from '@/lib/nav';
import { cn } from '@/lib/cn';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

/** Shared, brand-tinted focus ring for drawer controls (WCAG AA). */
const DRAWER_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Elements inside the panel that can hold focus while the trap is active. */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Matches the `lg` breakpoint, above which the drawer is replaced by the dock. */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** The shell's standard ease — mirrors `ease-astroid` in the Tailwind config. */
const EASE_ASTROID = [0.22, 1, 0.36, 1] as const;

/**
 * Slide-in navigation for narrow viewports (mirrors the desktop command dock).
 *
 * Framer Motion drives the open and close animation, and `AnimatePresence`
 * keeps the panel out of the DOM entirely while closed — so an off-screen
 * drawer can never put its links in the keyboard tab order. While open the
 * drawer traps focus, closes on Escape, on backdrop click, and on selecting a
 * link (including a link to the current route), locks body scroll, and returns
 * focus to whatever opened it. Animation collapses to an instant state change
 * when the viewer prefers reduced motion.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  // Dismiss on route change — but not on first mount, where there is no
  // navigation to react to.
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Growing past `lg` swaps the drawer for the dock; leaving it open there
  // would trap focus in a panel the viewport no longer shows.
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    if (query.matches) {
      onClose();
      return undefined;
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open, onClose]);

  // Escape dismissal, focus trap, scroll lock, and trigger focus restoration.
  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusRef: closeButtonRef,
  });

  const panelTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };

  const fadeTransition: Transition = {
    duration: reduceMotion ? 0 : 0.2,
    ease: EASE_ASTROID,
  };

  // Reduced motion gets a cross-fade in place rather than a slide.
  const panelOffset = reduceMotion ? 0 : '-100%';

  const handleLinkSelect = useCallback(() => onClose(), [onClose]);

  return (
    // Both children sit directly under AnimatePresence — a wrapping fragment
    // would hide them from its child diffing and skip the exit animation.
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-nav-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeTransition}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}
      {open && (
        <motion.aside
          key="mobile-nav-drawer"
          id="mobile-nav-drawer"
          ref={panelRef}
          role="dialog"
          aria-label="Navigation"
          aria-modal="true"
          initial={{ x: panelOffset, opacity: reduceMotion ? 0 : 1 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: panelOffset, opacity: reduceMotion ? 0 : 1 }}
          transition={panelTransition}
          className="fixed left-0 top-0 z-50 flex h-full w-[264px] flex-col border-r border-border bg-surface shadow-soft-3 lg:hidden"
        >
          <div className="h-16 flex items-center justify-between px-5">
            <span className="gap-2.5 flex items-center">
              <span className="grid h-8 w-8 place-items-center rounded-button bg-accent-gradient text-white shadow-gold">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">
                Astroid
              </span>
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground',
                DRAWER_FOCUS,
              )}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            {navSections.map((section) => (
              <div key={section.heading} className="space-y-1">
                <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  {section.heading}
                </p>
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkSelect}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        DRAWER_FOCUS,
                        'flex items-center gap-3 rounded-button px-3 py-2 text-sm font-medium transition-colors duration-fast',
                        active
                          ? 'bg-surface-secondary text-foreground'
                          : 'text-foreground-secondary hover:bg-surface-secondary/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                      {item.signature && (
                        <span
                          className="h-1.5 w-1.5 ml-auto rounded-xs bg-gold"
                          aria-hidden
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
