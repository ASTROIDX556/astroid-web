'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion';
import { useThemeStore } from '@/stores/theme-store';

/** Built-in animation presets for dashboard tab and view switchers. */
export type TabTransitionVariant = 'fade' | 'slide-up' | 'scale';

export interface TabTransitionProps {
  /**
   * Identity of the active tab / view. Changing it triggers the exit → enter
   * pair; keep it stable between renders of the same view.
   */
  activeKey: string;
  /** Animation preset. Defaults to `slide-up`. */
  variant?: TabTransitionVariant;
  children: React.ReactNode;
  className?: string;
  /**
   * Animate the very first mount. Defaults to `false` so the initial dashboard
   * paint is instant and cannot flash before hydration.
   */
  animateOnMount?: boolean;
  /** How to stitch the outgoing and incoming views. Defaults to `wait`. */
  mode?: 'wait' | 'sync';
}

/**
 * Shared motion values. They mirror the design tokens in
 * `src/styles/tokens.css` (`--motion-duration-base`, `--motion-ease-standard`)
 * and the Tailwind `duration-base` / `ease-astroid` utilities. They are
 * duplicated as numbers because Framer Motion cannot resolve CSS variables for
 * JavaScript-driven transitions.
 */
const MOTION_DURATION_SECONDS = 0.18;
const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const MOTION_TRANSITION: Transition = {
  duration: MOTION_DURATION_SECONDS,
  ease: MOTION_EASE,
};

/** Reduced-motion variants cross-fade without any travel or scaling. */
const REDUCED_MOTION_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const FULL_MOTION_VARIANTS: Record<TabTransitionVariant, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  'slide-up': {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

export function resolveTabTransitionVariants(
  variant: TabTransitionVariant,
  reducedMotion: boolean,
): Variants {
  return reducedMotion ? REDUCED_MOTION_VARIANTS : FULL_MOTION_VARIANTS[variant];
}

/**
 * Reusable Framer Motion wrapper for dashboard tabs and view switchers.
 *
 * It keeps the animated surface layout-neutral (only `opacity` and `transform`
 * change, which are compositor-only properties), so swapping views never
 * reflows surrounding content or shifts focusable elements. When either the OS
 * `prefers-reduced-motion` setting or the in-app reduced-motion preference is
 * on, the transition degrades to an instant cross-fade.
 */
export function TabTransition({
  activeKey,
  variant = 'slide-up',
  children,
  className,
  animateOnMount = false,
  mode = 'wait',
}: TabTransitionProps) {
  const systemReducedMotion = useReducedMotion();
  const preferenceReducedMotion = useThemeStore((state) => state.reducedMotion);
  const reducedMotion = Boolean(systemReducedMotion || preferenceReducedMotion);
  const variants = resolveTabTransitionVariants(variant, reducedMotion);

  return (
    <AnimatePresence mode={mode} initial={animateOnMount}>
      <motion.div
        key={activeKey}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={reducedMotion ? { duration: 0 } : MOTION_TRANSITION}
        className={className}
        style={reducedMotion ? undefined : { willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default TabTransition;
