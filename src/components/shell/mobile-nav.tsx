'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { navSections } from '@/lib/nav';
import { cn } from '@/lib/cn';

interface MobileNavProps {
  /** Whether the mobile navigation drawer is currently open. */
  open: boolean;
  /** Dismisses the mobile navigation drawer. */
  onClose: () => void;
}

/** Shared, brand-tinted focus ring for drawer controls (WCAG AA). */
const DRAWER_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Responsive, accessible mobile navigation drawer for narrow viewports.
 *
 * Uses Framer Motion for smooth slide-in/slide-out and backdrop blur fade transitions,
 * respecting `prefers-reduced-motion`. Integrates with {@link useFocusTrap} for focus
 * containment, scroll locking, Escape dismissal, and focus restoration.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Dismiss whenever the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape dismissal, focus trap, scroll lock, and trigger focus restoration.
  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusRef: closeButtonRef,
  });

  return (
    <AnimatePresence>
      {open && (
        <div className="lg:hidden">
          {/* Backdrop with subtle blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              ease: 'easeInOut',
            }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.aside
            id="mobile-nav-drawer"
            ref={panelRef}
            role="dialog"
            aria-label="Navigation"
            aria-modal="true"
            initial={{
              x: shouldReduceMotion ? 0 : '-100%',
              opacity: shouldReduceMotion ? 0 : 1,
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: shouldReduceMotion ? 0 : '-100%',
              opacity: shouldReduceMotion ? 0 : 1,
            }}
            transition={{
              type: shouldReduceMotion ? 'tween' : 'spring',
              damping: 25,
              stiffness: 250,
              duration: shouldReduceMotion ? 0 : undefined,
            }}
            className="fixed left-0 top-0 z-50 flex h-full w-[264px] max-w-[calc(100vw-3rem)] flex-col border-r border-border bg-surface shadow-soft-3 overflow-y-auto"
          >
            <div className="h-16 flex shrink-0 items-center justify-between px-5 border-b border-border/40">
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

            <nav className="flex-1 space-y-6 px-3 py-4">
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
                        aria-current={active ? 'page' : undefined}
                        onClick={onClose}
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
        </div>
      )}
    </AnimatePresence>
  );
}
