'use client';

import Link from 'next/link';
import {
  ArrowRight, CalendarCheck, ChevronRight, Clock, Droplets, Dumbbell, Flame, Gauge, LineChart, ListChecks, MessageSquare, Target, UserRound, Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { ClientDashboard } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { CountUp, ErrorState, Greeting } from '@/components/dashboard/primitives';
import { buttonVariants } from '@/components/ui/button';
import { Badge, Skeleton } from '@/components/ui/misc';

/**
 * Client home — deliberately minimal: who/what today is, four numbers, today's workout, six shortcuts and today's intake.
 * Everything detailed (charts, logs, history, messages) lives on its own page, one click away.
 */

const GOAL: Record<string, string> = { FAT_LOSS: 'Fat loss', RECOMPOSITION: 'Recomposition', MUSCLE_BUILDING: 'Muscle building' };

const STATUS: Record<string, { label: string; tone: string }> = {
  ASSIGNED: { label: 'Ready to start', tone: 'bg-primary/15 text-primary' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-chart-2/15 text-chart-2' },
  COMPLETED: { label: 'Completed', tone: 'bg-good/15 text-good' },
  SKIPPED: { label: 'Skipped', tone: 'bg-white/[0.06] text-muted-foreground' },
};

const QUICK: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'Workout', href: '/client/workout', icon: Dumbbell },
  { label: 'My Diet', href: '/client/diet', icon: Utensils },
  { label: 'Body Analysis', href: '/client/body-analysis', icon: Gauge },
  { label: 'Progress', href: '/client/progress', icon: LineChart },
  { label: 'Attendance', href: '/client/attendance', icon: CalendarCheck },
  { label: 'Messages', href: '/client/messages', icon: MessageSquare },
];

const card = 'rounded-2xl border border-white/[0.06] bg-card shadow-card';
const pct = (v: number, max: number | null | undefined) => (max && max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0);
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Trainer-set duration, or an estimate: every set ≈ 40 s of work plus its rest, rounded to 5 minutes. */
function durationMin(w: NonNullable<ClientDashboard['todaysWorkout']>): number {
  if (w.estimatedMin) return w.estimatedMin;
  const sec = w.exercises.reduce((s, e) => s + e.sets * (40 + e.restSec), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="presentation">
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-700 ease-out', className)} style={{ width: `${value}%` }} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, unit, progress }: { icon: LucideIcon; label: string; value: React.ReactNode; unit?: string; progress?: number }) {
  return (
    <div className={cn(card, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold leading-none tracking-tight tabular-nums">
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {progress !== undefined && <Bar value={progress} />}
    </div>
  );
}

function TodaysWorkout({ data }: { data: ClientDashboard }) {
  const w = data.todaysWorkout;
  if (!w) {
    return (
      <div className={cn(card, 'flex h-full flex-col items-start justify-center gap-3 p-6')}>
        <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-muted-foreground"><Dumbbell className="size-5" /></span>
        <div>
          <p className="font-display text-lg font-semibold">No workout assigned today.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Rest and recover, or check your workout history.</p>
        </div>
        <Link href="/client/workout-history" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full')}><ListChecks /> Workout history</Link>
      </div>
    );
  }
  const status = STATUS[w.status] ?? { label: 'Ready to start', tone: 'bg-primary/15 text-primary' };
  return (
    <div className={cn(card, 'relative flex h-full flex-col justify-between gap-5 overflow-hidden p-6')}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today’s workout</p>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', status.tone)}>{status.label}</span>
        </div>
        <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">{w.name}</h3>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Dumbbell className="size-4" /> {w.exercises.length} {w.exercises.length === 1 ? 'exercise' : 'exercises'}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> ~{durationMin(w)} min</span>
        </div>
      </div>
      <Link href="/client/workout" className={cn(buttonVariants(), 'group relative w-full rounded-xl sm:w-auto sm:self-start')}>
        View Workout <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function QuickNav() {
  return (
    <div className={cn(card, 'p-4')}>
      <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick access</p>
      <nav className="grid grid-cols-3 gap-2" aria-label="Quick access">
        {QUICK.map(({ label, href, icon: Icon }) => (
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

function DailyProgress({ data }: { data: ClientDashboard }) {
  const t = data.nutrition.target;
  const c = data.nutrition.consumed;
  const rows = [
    { label: 'Calories', value: c.calories, target: t?.calories, unit: 'kcal', bar: 'bg-primary' },
    { label: 'Protein', value: c.proteinG, target: t?.proteinG, unit: 'g', bar: 'bg-chart-4' },
    { label: 'Water', value: data.habits.waterMl, target: t?.waterMl, unit: 'ml', bar: 'bg-chart-2' },
  ];
  return (
    <div className={cn(card, 'p-5')}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">Daily progress</p>
          {!t && <p className="text-xs text-muted-foreground">Your trainer hasn’t set targets yet.</p>}
        </div>
        <Link href="/client/diet" className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
          View Details <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {rows.map((r) => (
          <div key={r.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{fmt(r.value)}</span>{r.target ? ` / ${fmt(r.target)}` : ''} {r.unit}</span>
            </div>
            <Bar value={pct(r.value, r.target)} className={r.bar} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[108px] rounded-2xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-5"><Skeleton className="h-56 rounded-2xl lg:col-span-3" /><Skeleton className="h-56 rounded-2xl lg:col-span-2" /></div>
      <Skeleton className="h-28 rounded-2xl" />
    </div>
  );
}

export default function ClientDashboardPage() {
  const { data, error, reload } = useApi<ClientDashboard>('/clients/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <DashboardSkeleton />;

  const waterTarget = data.nutrition.target?.waterMl ?? null;
  const week = data.week;

  return (
    <div className="space-y-5">
      {/* A — welcome */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground"><Greeting /></p>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{data.greetingName}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary"><Target className="size-3.5" /> {data.goal ? GOAL[data.goal] : 'No goal set yet'}</Badge>
          {data.trainerName && <Badge><UserRound className="size-3.5" /> Coach {data.trainerName}</Badge>}
        </div>
      </header>

      {/* B — overview */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Overview">
        <Stat icon={Flame} label="Workout streak" value={<CountUp value={data.streakDays} />} unit={data.streakDays === 1 ? 'day' : 'days'} />
        <Stat icon={Dumbbell} label="Workouts this week" value={`${week.workoutsCompleted}/${week.workoutsPlanned}`} progress={pct(week.workoutsCompleted, week.workoutsPlanned)} />
        <Stat icon={CalendarCheck} label="Gym attendance" value={<CountUp value={week.attendanceDays} />} unit={week.attendanceDays === 1 ? 'day this week' : 'days this week'} />
        <Stat icon={Droplets} label="Water intake" value={<CountUp value={data.habits.waterMl} />} unit="ml" progress={waterTarget ? pct(data.habits.waterMl, waterTarget) : undefined} />
      </section>

      {/* C + D — today's workout and shortcuts */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><TodaysWorkout data={data} /></div>
        <div className="lg:col-span-2"><QuickNav /></div>
      </section>

      {/* E — today's intake */}
      <DailyProgress data={data} />
    </div>
  );
}
