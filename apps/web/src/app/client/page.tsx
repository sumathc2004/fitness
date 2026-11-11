'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck, Clock, Droplets, Dumbbell, Flame, Gauge, LineChart, ListChecks, MessageSquare, Target, UserRound, Utensils } from 'lucide-react';
import type { ClientDashboard } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { CountUp, ErrorState } from '@/components/dashboard/primitives';
import { fmt, HomeHeader, homeCard, HomeSkeleton, MainRow, pct, QuickAccess, Stat, StatRow, SummaryStrip, type QuickItem } from '@/components/dashboard/home';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';

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

const QUICK: QuickItem[] = [
  { label: 'Workout', href: '/client/workout', icon: Dumbbell },
  { label: 'My Diet', href: '/client/diet', icon: Utensils },
  { label: 'Body Analysis', href: '/client/body-analysis', icon: Gauge },
  { label: 'Progress', href: '/client/progress', icon: LineChart },
  { label: 'Attendance', href: '/client/attendance', icon: CalendarCheck },
  { label: 'Messages', href: '/client/messages', icon: MessageSquare },
];

/** Trainer-set duration, or an estimate: every set ≈ 40 s of work plus its rest, rounded to 5 minutes. */
function durationMin(w: NonNullable<ClientDashboard['todaysWorkout']>): number {
  if (w.estimatedMin) return w.estimatedMin;
  const sec = w.exercises.reduce((s, e) => s + e.sets * (40 + e.restSec), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

function TodaysWorkout({ data }: { data: ClientDashboard }) {
  const w = data.todaysWorkout;
  if (!w) {
    return (
      <div className={cn(homeCard, 'flex h-full flex-col items-start justify-center gap-3 p-6')}>
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
    <div className={cn(homeCard, 'relative flex h-full flex-col justify-between gap-5 overflow-hidden p-6')}>
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

export default function ClientDashboardPage() {
  const { data, error, reload } = useApi<ClientDashboard>('/clients/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <HomeSkeleton />;

  const t = data.nutrition.target;
  const c = data.nutrition.consumed;
  const week = data.week;

  return (
    <div className="space-y-5">
      <HomeHeader
        name={data.greetingName}
        badges={<>
          <Badge variant="primary"><Target className="size-3.5" /> {data.goal ? GOAL[data.goal] : 'No goal set yet'}</Badge>
          {data.trainerName && <Badge><UserRound className="size-3.5" /> Coach {data.trainerName}</Badge>}
        </>}
      />

      <StatRow>
        <Stat icon={Flame} label="Workout streak" value={<CountUp value={data.streakDays} />} unit={data.streakDays === 1 ? 'day' : 'days'} hint="Consecutive active days" />
        <Stat icon={Dumbbell} label="Workouts this week" value={`${week.workoutsCompleted}/${week.workoutsPlanned}`} progress={pct(week.workoutsCompleted, week.workoutsPlanned)} />
        <Stat icon={CalendarCheck} label="Gym attendance" value={<CountUp value={week.attendanceDays} />} unit={week.attendanceDays === 1 ? 'day' : 'days'} hint="This week" />
        <Stat icon={Droplets} label="Water intake" value={<CountUp value={data.habits.waterMl} />} unit="ml" progress={t?.waterMl ? pct(data.habits.waterMl, t.waterMl) : undefined} hint="No target set yet" />
      </StatRow>

      <MainRow main={<TodaysWorkout data={data} />} side={<QuickAccess items={QUICK} />} />

      <SummaryStrip
        title="Daily progress"
        href="/client/diet"
        note={t ? undefined : 'Your trainer hasn’t set targets yet.'}
        rows={[
          { label: 'Calories', value: `${fmt(c.calories)}${t ? ` / ${fmt(t.calories)}` : ''} kcal`, percent: pct(c.calories, t?.calories), bar: 'bg-primary' },
          { label: 'Protein', value: `${fmt(c.proteinG)}${t ? ` / ${fmt(t.proteinG)}` : ''} g`, percent: pct(c.proteinG, t?.proteinG), bar: 'bg-chart-4' },
          { label: 'Water', value: `${fmt(data.habits.waterMl)}${t?.waterMl ? ` / ${fmt(t.waterMl)}` : ''} ml`, percent: pct(data.habits.waterMl, t?.waterMl), bar: 'bg-chart-2' },
        ]}
      />
    </div>
  );
}
