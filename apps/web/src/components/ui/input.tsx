import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-11 w-full rounded-md border border-input bg-white/[0.03] px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors',
      'focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-destructive/70 aria-[invalid=true]:ring-destructive/20',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('text-xs font-medium uppercase tracking-wider text-muted-foreground', className)} {...props} />
);

/** Label + input + inline error, wired for accessibility. */
export function Field({ label, error, hint, id, children }: { label: string; error?: string; hint?: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
