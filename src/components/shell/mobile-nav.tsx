'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
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

/** Slide-in navigation for narrow viewports (mirrors the desktop sidebar). */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    <div className="lg:hidden" aria-hidden={!open}>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-background/50 backdrop-blur-sm transition-opacity duration-base',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        id="mobile-nav-drawer"
        ref={panelRef}
        role="dialog"
        aria-label="Navigation"
        aria-modal="true"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[264px] flex-col border-r border-border bg-surface shadow-soft-3 transition-transform duration-base ease-astroid',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
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
      </aside>
    </div>
  );
}
