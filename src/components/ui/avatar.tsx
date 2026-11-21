import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-sans font-semibold uppercase',
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-2xs',
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-lg',
        xl: 'h-20 w-20 text-2xl',
      },
      shape: {
        circle: 'rounded-md',
        squircle: 'rounded-md',
      },
    },
    defaultVariants: { size: 'md', shape: 'squircle' },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string;
  className?: string;
}

/** Deterministic warm tint per name so avatars stay stable across renders. */
function tint(name: string): string {
  const tints = [
    'bg-gold-soft text-gold-strong',
    'bg-info-soft text-info',
    'bg-success-soft text-success',
    'bg-warning-soft text-warning',
    'bg-surface-secondary text-foreground',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return tints[hash % tints.length] as string;
}

export function Avatar({ name, src, size, shape, className }: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size, shape }), !src && tint(name), className)}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
