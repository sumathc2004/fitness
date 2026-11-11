'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Greeting } from './primitives';
import { Skeleton } from '@/components/ui/misc';

/**
 * Building blocks shared by the three role home pages (client, trainer, admin), so they read as one product:
 * a compact header, four stat cards, one main panel + quick access, and one slim summary strip.
 */

export const homeCard = 'rounded-2xl border border-white/[0.06] bg-card shadow-card';
export const pct = (v: number, max: number | null | undefined) => (max && max > 0 ? Math.max(0, Math.min(100, Math.round((v / max) * 100))) : 0);
export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export function HomeHeader({ name, subtitle, badges }: { name: string; subtitle?: string; badges?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground"><Greeting />{subtitle ? <span className="text-muted-foreground/70"> · {subtitle}</span> : null}</p>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{name}</h2>
      </div>
      {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
    </header>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="presentation">
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-700 ease-out', className)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Stat({ icon: Icon, label, value, unit, progress, tone = 'primary', hint, href }: {
  icon: LucideIcon; label: string; value: React.ReactNode; unit?: string; progress?: number; tone?: 'primary' | 'attention'; hint?: string;
  /** Makes the whole card a link (e.g. "Need attention" → the client list). */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={cn('grid size-8 place-items-center rounded-lg', tone === 'attention' ? 'bg-attention/15 text-attention' : 'bg-primary/10 text-primary')}><Icon className="size-4" /></span>
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold leading-none tracking-tight tabular-nums">
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {progress !== undefined ? <Bar value={progress} /> : hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  return href
    ? <Link href={href} className={cn(homeCard, 'flex flex-col gap-3 p-4 transition-colors hover:border-primary/40')}>{body}</Link>
    : <div className={cn(homeCard, 'flex flex-col gap-3 p-4')}>{body}</div>;
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Overview">{children}</section>;
}

/** Small pill link used in panel headers ("View all ›"). */
export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(homeCard, 'flex flex-col p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export interface QuickItem { label: string; href: string; icon: LucideIcon }

export function QuickAccess({ items }: { items: QuickItem[] }) {
  return (
    <div className={cn(homeCard, 'h-full p-4')}>
      <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick access</p>
      <nav className="grid grid-cols-3 gap-2" aria-label="Quick access">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-1 py-3 text-center text-xs font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-foreground active:translate-y-0 active:scale-[0.97]"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="size-[18px]" /></span>
            <span className="leading-tight">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export interface MetricRow { label: string; value: string; percent: number; bar?: string; note?: string }

/** The slim summary strip at the bottom of each home page: three labelled progress bars + one link. */
export function SummaryStrip({ title, href, linkLabel = 'View Details', rows, note, className }: { title: string; href: string; linkLabel?: string; rows: MetricRow[]; note?: string; className?: string }) {
  return (
    <div className={cn(homeCard, 'p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">{title}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        <MoreLink href={href}>{linkLabel}</MoreLink>
      </div>
      <div className={cn('grid gap-4 sm:gap-6', rows.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        {rows.map((r) => (
          <div key={r.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{r.value}</span>
            </div>
            <Bar value={r.percent} className={r.bar} />
            {r.note && <p className="text-[11px] text-muted-foreground">{r.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two-column middle row: main panel (3/5) + quick access (2/5). */
export function MainRow({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">{main}</div>
      <div className="min-w-0 lg:col-span-2">{side}</div>
    </section>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[108px] rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-5"><Skeleton className="h-56 rounded-2xl lg:col-span-3" /><Skeleton className="h-56 rounded-2xl lg:col-span-2" /></div>
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}
