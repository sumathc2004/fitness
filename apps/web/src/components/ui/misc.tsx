import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'border-white/10 bg-white/[0.06] text-foreground',
      primary: 'border-primary/30 bg-primary/10 text-primary',
      good: 'border-good/30 bg-good/10 text-good',
      monitor: 'border-monitor/30 bg-monitor/10 text-monitor',
      attention: 'border-attention/30 bg-attention/10 text-attention',
      muted: 'border-transparent bg-white/[0.05] text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('skeleton', className)} aria-hidden {...props} />;

/** Horizontal progress bar (nutrition macros, completion rates). */
export function Progress({ value, max = 100, className, barClassName, label }: { value: number; max?: number; className?: string; barClassName?: string; label?: string }) {
  const p = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-700 ease-out', barClassName)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Avatar({ name, className, size = 36 }: { name: string; className?: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-chart-2/80 font-display font-bold text-primary-foreground', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {text}
    </span>
  );
}
