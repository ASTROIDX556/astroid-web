import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-muted transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leftIcon, ...props }, ref) => {
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

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      fieldBase,
      'min-h-[96px] py-2.5 leading-relaxed',
      invalid && 'border-danger focus-visible:ring-danger',
      className,
    )}
    aria-invalid={invalid}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...props }, ref) => (
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
  children: React.ReactNode;
  className?: string;
}

interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
}

/** True for the elements a label can name: our field primitives and the native controls. */
function isFieldControl(child: React.ReactElement): boolean {
  return (
    child.type === Input ||
    child.type === Select ||
    child.type === Textarea ||
    child.type === 'input' ||
    child.type === 'select' ||
    child.type === 'textarea'
  );
}

/**
 * Labelled form field with hint + accessible error messaging.
 *
 * The label, the hint or error and the control are tied together here, so a
 * form does not have to: the label names the control (`htmlFor`), the visible
 * message is its `aria-describedby`, and an error also sets `aria-invalid`.
 * The control keeps its own `id` if it has one; otherwise it gets a generated
 * one. A child that is not a form control (a wrapper `div`, say) is rendered
 * untouched.
 */
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
  const child = isValidElement<FieldControlProps>(children) && isFieldControl(children) ? children : null;
  const id = htmlFor ?? child?.props.id ?? generatedId;
  // Message ids come from this field's own generated id, not from the control's:
  // two forms on one page can reuse a control id, and a message id must still be unique.
  const messageId = error ? `${generatedId}-error` : hint ? `${generatedId}-hint` : undefined;

  let control = children;
  if (child) {
    const describedBy = [child.props['aria-describedby'], messageId].filter(Boolean).join(' ');
    control = cloneElement(child, {
      id,
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      ...(error ? { 'aria-invalid': true } : {}),
      ...(required ? { 'aria-required': true } : {}),
    });
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="text-2xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-2xs text-foreground-secondary">
          {hint}
        </p>
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

/** Accessible toggle switch. */
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
      {label && <span>{label}</span>}
    </label>
  );
}
