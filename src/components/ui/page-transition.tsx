'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useThemeStore } from '@/stores/theme-store';

export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const systemReducedMotion = useReducedMotion();
  const preferenceReducedMotion = useThemeStore((state) => state.reducedMotion);
  const reducedMotion = systemReducedMotion || preferenceReducedMotion;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname ?? 'page'}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}