'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ActivityItem, AttentionLevel, ClientAttention } from '@gym/types';
import { cn, greeting, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';

// ───────────────────────── numbers
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-IN') }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 0.9, ease: 'easeOut', onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value]);
  return <span ref={ref}>{format(inView ? shown : 0)}</span>;
}

export function StatCard({
  label, value, hint, icon: Icon, format, suffix, tone = 'default', index = 0,
}: { label: string; value: number | string; hint?: string; icon: LucideIcon; format?: (n: number) => string; suffix?: string; tone?: 'default' | 'primary' | 'attention'; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.45, ease: 'easeOut' }}>
      <Card className="group relative overflow-hidden transition-colors hover:border-white/[0.12]">
        <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-primary/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <span className={cn('grid size-9 place-items-center rounded-md', tone === 'primary' ? 'bg-primary/15 text-primary' : tone === 'attention' ? 'bg-attention/15 text-attention' : 'bg-white/[0.05] text-muted-foreground')}>
              <Icon className="size-[18px]" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight tabular-nums">
            {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
            {suffix && <span className="ml-1 text-base font-medium text-muted-foreground">{suffix}</span>}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card><CardContent className="space-y-3 p-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32" /></CardContent></Card>
  );
}

export function Section({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div><CardTitle>{title}</CardTitle>{description && <CardDescription className="mt-1">{description}</CardDescription>}</div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ───────────────────────── states
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-white/[0.05] text-muted-foreground"><Icon className="size-6" /></span>
      <div>
        <p className="font-display font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-destructive" />
      <div><p className="font-display font-semibold">We couldn’t load this</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw /> Try again</Button>}
    </div>
  );
}

// ───────────────────────── client status
const LEVEL: Record<AttentionLevel, { label: string; dot: string; variant: 'good' | 'monitor' | 'attention' | 'primary' }> = {
  GOOD: { label: 'Good', dot: 'bg-good', variant: 'good' },
  MONITOR: { label: 'Monitor', dot: 'bg-monitor', variant: 'monitor' },
  ATTENTION: { label: 'Needs attention', dot: 'bg-attention', variant: 'attention' },
  NEW: { label: 'New', dot: 'bg-primary', variant: 'primary' },
};

export function ClientStatusBadge({ level }: { level: AttentionLevel }) {
  const l = LEVEL[level];
  return (
    <Badge variant={l.variant}>
      <span className={cn('size-1.5 rounded-full', l.dot, level === 'ATTENTION' && 'animate-pulse')} /> {l.label}
    </Badge>
  );
}

export function AttentionList({ items, emptyText = 'Everyone is on track.' }: { items: ClientAttention[]; emptyText?: string }) {
  if (items.length === 0) return <EmptyState icon={AlertTriangle} title="Nothing needs attention" description={emptyText} />;
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((c) => (
        <li key={c.clientId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <Avatar name={c.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.name}</span><ClientStatusBadge level={c.level} /></div>
            {c.reasons.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">{c.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Joined recently — no signals yet.</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{c.lastActivityAt ? timeAgo(c.lastActivityAt) : 'no activity'}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyState icon={AlertTriangle} title="No activity yet" description="Workouts, meals and check-ins will appear here as clients use the app." />;
  return (
    <ul className="space-y-3.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3">
          <Avatar name={a.clientName ?? '?'} size={30} />
          <p className="min-w-0 flex-1 truncate text-sm">{a.summary}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── rate ring
export function RateRing({ value, label, size = 112 }: { value: number | null; label: string; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const p = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={9} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={9} strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-display text-xl font-bold tabular-nums">{value == null ? '—' : `${Math.round(p * 100)}%`}</div>
      </div>
      <p className="text-center text-xs font-medium text-muted-foreground">{label}</p>
      {value == null && <p className="-mt-1 text-[11px] text-muted-foreground/70">No data yet</p>}
    </div>
  );
}

/** Time-of-day greeting; resolved after mount so server and browser time zones can't cause a hydration mismatch. */
export function Greeting() {
  const [g, setG] = useState('Welcome');
  useEffect(() => setG(greeting()), []);
  return <>{g}</>;
}
