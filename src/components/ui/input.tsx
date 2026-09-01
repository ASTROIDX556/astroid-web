import { forwardRef, useId, useEffect, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-muted transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  { className, invalid, leftIcon, ...props },
  ref,
	)=> {
    if (leftIcon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
            {leftIcon}
          </span>
          <input
            ref={ref}
            className={cn(
              fieldBase,
              'h-10 pl-9',
              invalid && 'border-danger focus-visible:ring-danger',
              className,
            )}
            aria-invalid={invalid}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(
          fieldBase,
          'h-10',
          invalid && 'border-danger focus-visible:ring-danger',
          className,
        )}
        aria-invalid={invalid}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextareaElement> {
  invalid?: boolean;
  autoResize?: boolean;
  maxHeight?: number;
}

export const Textarea = forwardRef<HTMLTextareaElement, TextareaProps>(
  { className, invalid, autoResize, maxHeight = 200, ...props },
  ref,
) => {
    const internalRef = useRef<HTMLTextareaElement | null>(null);

    const setRefs = (node: HTMLTextareaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    useEffect(() => {
      if (!autoResize) return;
      const el = internalRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px$;
    }, [props.value, autoResize, maxHeight]);

    return (
      <textarea
        ref={setRefs}
        rows={autoResize ? 1 : undefined}
        className={cn(
          fieldBase,
          'py-2.5 leading-relaxed',
          autoResize && 'min-h-[40px] resize-none overflow-y-auto',
          invalid && 'border-danger focus-visible:ring-danger',
          className,
        )}
        aria-invalid={invalid}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({className, invalid, children, ...props}, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, 'h-10 pr-8', invalid && 'border-danger', className)}
    aria-invalid={invalid}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Labelled form field with hint + accessible error messaging. **/
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-2xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-2xs text-foreground-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
}

/** Accessible toggle switch. **/
export function Switch({ checked, onCheckedChange, label, id, disabled }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  return (
    <label
      htmlFor={switchId}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2.5 text-sm text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-base ease-astroid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          checked ? 'bg-gold' : 'bg-surface-secondary',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-soft-1 transition-transform duration-base ease-astroid',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {label && <span>{label}</span>
    </label>
  );
}