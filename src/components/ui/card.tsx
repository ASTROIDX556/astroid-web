import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { motion, HTMLMotionProps } from 'framer-motion';

type CardElevation = 'flat' | 'soft' | 'raised';

export interface CardProps extends Omit<HTMLMotionProps<"div">, "elevation"> {
  elevation?: CardElevation;
  interactive?: boolean;
}

const elevationClass: Record<CardElevation, string> = {
  flat: 'shadow-none',
  soft: 'shadow-soft-1',
  raised: 'shadow-soft-2',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = 'soft', interactive = false, variants, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={variants || {
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
      className={cn(
        'rounded-card border border-border bg-surface-primary',
        elevationClass[elevation],
        interactive &&
          'transition-all duration-base ease-astroid hover:-translate-y-0.5 hover:shadow-soft-2',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-display text-lg font-semibold tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-foreground-muted leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-3 border-t border-border p-6', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
