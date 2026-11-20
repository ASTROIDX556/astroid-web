import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'gap-1.5 px-2.5 py-0.5 inline-flex items-center whitespace-nowrap rounded-full font-sans font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-secondary text-foreground-secondary',
        gold: 'bg-gold-soft text-gold-strong',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        outline: 'border border-border text-foreground-secondary',
      },
      size: {
        sm: 'py-0.5 px-2 text-2xs',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
    </span>
  );
}

export { badgeVariants };
