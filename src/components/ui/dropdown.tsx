'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  trailing?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | 'separator')[];
  align?: 'start' | 'end';
  className?: string;
  /** Classes appended to the trigger button — used for shared focus rings. */
  triggerClassName?: string;
  /** Accessible name for the trigger button, e.g. "Switch organization". */
  'aria-label'?: string;
}

/** Shared, brand-tinted focus ring for menu items (WCAG AA). */
const ITEM_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

/**
 * Click-to-open menu with outside-click + Escape dismissal and full keyboard
 * support: ArrowUp/ArrowDown move between items, Home/End jump to the first or
 * last item, Enter/Space activate, and Tab closes without trapping focus.
 */
export function Dropdown({ trigger, items, align = 'end', className, triggerClassName, 'aria-label': ariaLabel }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Arrow-key navigation between menu items, per the WAI-ARIA menu pattern.
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const focusables = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (focusables.length === 0) return;

    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusables.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex < 0 ? focusables.length - 1 : (currentIndex - 1 + focusables.length) % focusables.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = focusables.length - 1;
        break;
    }
    e.preventDefault();
    focusables[nextIndex]?.focus();
  };

  // Focus the first item when opened via the keyboard, per the menu pattern.
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        menuRef.current
          ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
          ?.focus();
      });
    }
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn('inline-flex rounded-button', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel ? `${ariaLabel} options` : undefined}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'glass absolute top-full z-50 mt-2 min-w-[200px] animate-fade-in overflow-hidden rounded-md p-1.5 shadow-soft-2',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {items.map((item, i) => {
            if (item === 'separator') {
              return <div key={`sep-${i}`} className="my-1 h-px bg-border" role="separator" />;
            }
            const content = (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {item.icon && (
                  <span className="shrink-0 text-foreground-secondary">{item.icon}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description && (
                    <span className="mt-1 block truncate text-2xs font-normal text-foreground-muted">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.trailing}
              </div>
            );
            const classes = cn(
              'flex w-full items-center rounded-sm px-2.5 py-2 text-left text-xs font-medium transition-colors duration-fast',
              item.destructive
                ? 'text-danger hover:bg-danger-soft'
                : 'text-foreground hover:bg-surface-secondary',
              item.disabled && 'pointer-events-none opacity-50',
              ITEM_FOCUS,
            );
            if (item.href) {
              return (
                <a key={item.label} href={item.href} role="menuitem" className={classes}>
                  {content}
                </a>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                className={classes}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
