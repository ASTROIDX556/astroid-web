import { motion, useSpring } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';

// Common entrance stagger for pages
export const PageTransition = ({ children, className }: { children: ReactNode, className?: string }) => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      exit="hidden"
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.05 } }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerContainer = ({ children, className }: { children: ReactNode, className?: string }) => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({ children, className }: { children: ReactNode, className?: string }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        show: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1]
          }
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Animated Number Counter
export const AnimatedNumber = ({ value, formatter }: { value: number, formatter: (val: number) => string }) => {
  const safeValue = typeof value === 'number' && isFinite(value) ? value : 0;
  const spring = useSpring(safeValue, { mass: 0.8, stiffness: 75, damping: 15 });
  const [display, setDisplay] = useState(() => {
    try { return formatter(safeValue); } catch { return '-'; }
  });

  useEffect(() => {
    spring.set(safeValue);
  }, [safeValue, spring]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      try { setDisplay(formatter(latest)); } catch { setDisplay('-'); }
    });
  }, [spring, formatter]);

  return <span>{display}</span>;
};

// Chat panel slide-in animation (e.g., from right edge)
export const chatPanelVariants = {
  hidden: { x: '100%', opacity: 0 },
  show: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

// Chat message entrance animation
export const chatMessageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};

// Container for stagger messages
export const chatMessagesContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
