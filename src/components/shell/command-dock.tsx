'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { navSections } from '@/lib/nav';
import { useCommandStore, useAssistantStore } from '@/stores/ui-store';
import { cn } from '@/lib/cn';

/**
 * Floating command dock — the workspace's primary navigation on desktop.
 *
 * Replaces the sidebar (and the horizontal top-nav) with a single centred,
 * glass pill anchored to the bottom of the viewport. Every destination is one
 * click away, the active surface expands to reveal its label, and the ⌘K search
 * plus AI assistant sit at either end. Narrow viewports fall back to the slide-in
 * drawer (see {@link MobileNav}); the dock is hidden below `lg`.
 */
/** Shared, brand-tinted focus ring for every dock control (WCAG AA). */
const DOCK_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function CommandDock() {
  const pathname = usePathname();
  const commandOpen = useCommandStore((s) => s.open);
  const openCommand = useCommandStore((s) => s.setOpen);
  const openAssistant = useAssistantStore((s) => s.setOpen);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-40 hidden justify-center px-4 lg:flex"
    >
      <div className="glass pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full border border-border p-1.5 shadow-soft-3 no-scrollbar">
        {/* Search */}
        <DockButton
          onClick={() => openCommand(true)}
          label="Search"
          hint="⌘K"
          icon={<Search className="h-[18px] w-[18px]" aria-hidden />}
          focusRing={DOCK_FOCUS}
          expanded={commandOpen}
          controls="command-palette"
        />

        <Divider />

        {navSections.map((section, index) => (
          <div key={section.heading} className="flex items-center gap-1">
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    DOCK_FOCUS,
                    'group relative flex h-11 items-center rounded-full px-3 text-sm font-medium transition-colors duration-fast',
                    active
                      ? 'text-foreground'
                      : 'text-foreground-secondary hover:bg-surface-secondary hover:text-foreground',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="dock-active"
                      className="absolute inset-0 rounded-full bg-gold-soft"
                      transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active ? 'text-gold' : 'opacity-80',
                      )}
                      aria-hidden
                    />
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </span>
                  {item.signature && !active && (
                    <span
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold"
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
            {index < navSections.length - 1 && <Divider />}
          </div>
        ))}

        <Divider />

        {/* AI assistant */}
        <DockButton
          onClick={() => openAssistant(true)}
          label="AI assistant"
          icon={<Sparkles className="h-[18px] w-[18px] text-gold" aria-hidden />}
          focusRing={DOCK_FOCUS}
        />
      </div>
    </nav>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />;
}

function DockButton({
  onClick,
  label,
  hint,
  icon,
  focusRing,
  expanded,
  controls,
}: {
  onClick: () => void;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  focusRing?: string;
  /** When the button opens a overlay, its expanded state for assistive tech. */
  expanded?: boolean;
  /** The id of the element the button controls, e.g. `command-palette`. */
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      aria-haspopup={controls ? 'dialog' : undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground',
        focusRing,
      )}
    >
      {icon}
    </button>
  );
}
