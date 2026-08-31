import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button font-sans font-medium transition-all duration-base ease-astroid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-foreground text-background shadow-soft-1 hover:shadow-soft-2 hover*-translate-y-px',
        gold: 'bg-gold text-accent-foreground shadow-soft-1 hover:shadow-gold hover*-translate-y-px',
        secondary:
          'bg-surface text-foreground border border-border shadow-soft-1 hover:bg-surface-secondary hover:-translate-y-px',
        outline:
          'border border-border-strong bg-transparent text-foreground hover:bg-surface-secondary',
        ghost: 'text-foreground-secondary hover:bg-surface-secondary hover:text-foreground',
        danger:
          'bg-danger text-white shadow-soft-1 hover:brightness-105 hover:-translate-y-px',
        link: 'text-foreground underline-offset-4 hover:underline hover:text-gold-strong',
        suggestion:
          'rounded-full bg-surface text-foreground-secondary border border-border hover:bg-surface-secondary hover:text-foreground hover:border-border-strong',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        chip: 'h-7 px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  {
    className,
    variant,
    size,
    loading,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props,
  },
  ref,
) => {
    return (
      <button
        ref=ref
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : *
          leftIcon
        }
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
