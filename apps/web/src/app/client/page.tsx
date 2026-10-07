'use client';

import { Droplets, Dumbbell, Flame, Lock, MessageSquare, Moon, Salad, Target, TrendingDown } from 'lucide-react';
import type { ClientDashboard } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { timeAgo } from '@/lib/utils';
import { Greeting, EmptyState, ErrorState, RateRing, Section, StatCard, StatCardSkeleton } from '@/components/dashboard/primitives';
import { WeightLineChart } from '@/components/dashboard/charts';
import { Button } from '@/components/ui/button';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';

const GOAL: Record<string, string> = { FAT_LOSS: 'Fat loss', RECOMPOSITION: 'Recomposition', MUSCLE_BUILDING: 'Muscle building' };

function Macro({ label, value, target, unit = 'g', accent }: { label: string; value: number; target: number | null; unit?: string; accent?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{value.toLocaleString('en-IN')}</span>{target != null && ` / ${Math.round(target).toLocaleString('en-IN')}`} {unit}</span>
      </div>
      <Progress value={value} max={target ?? 0} label={label} barClassName={accent} />
    </div>
  );
}

export default function ClientDashboardPage() {
  const { data, error, loading, reload } = useApi<ClientDashboard>('/clients/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const t = data?.nutrition.target ?? null;
  const c = data?.nutrition.consumed;
  const weekRate = data && data.week.workoutsPlanned > 0 ? data.week.workoutsCompleted / data.week.workoutsPlanned : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground"><Greeting /></p>
          <h2 className="font-display text-3xl font-bold tracking-tight">{data ? `${data.greetingName}, here’s your day` : <Skeleton className="h-9 w-72" />}</h2>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary"><Target className="size-3.5" /> {data.goal ? GOAL[data.goal] : 'No goal set yet'}</Badge>
            {data.trainerName && <Badge>Coach {data.trainerName}</Badge>}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label="Workout streak" value={data.streakDays} suffix={data.streakDays === 1 ? 'day' : 'days'} icon={Flame} tone="primary" hint="Consecutive active days" />
            <StatCard index={1} label="This week" value={`${data.week.workoutsCompleted}/${data.week.workoutsPlanned}`} icon={Dumbbell} hint="Workouts completed" />
            <StatCard index={2} label="Check-ins" value={data.week.attendanceDays} suffix="this week" icon={Target} />
            <StatCard index={3} label="Water today" value={data.habits.waterMl} suffix="ml" icon={Droplets} hint={t?.waterMl ? `Target ${t.waterMl.toLocaleString('en-IN')} ml` : 'No target set yet'} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Today’s workout" description={data?.todaysWorkout ? data.todaysWorkout.name : 'Planned by your trainer'} className="lg:col-span-2"
          action={data?.todaysWorkout ? <Badge variant="muted">{data.todaysWorkout.exercises.length} exercises</Badge> : undefined}>
          {loading || !data ? (
            <Skeleton className="h-52" />
          ) : !data.todaysWorkout ? (
            <EmptyState icon={Dumbbell} title="No workout today" description="Rest up, or message your trainer if you were expecting a session." />
          ) : (
            <div className="space-y-4">
              <ul className="divide-y divide-white/[0.05]">
                {data.todaysWorkout.exercises.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-4 py-3 first:pt-0">
                    <span className="grid size-9 place-items-center rounded-md bg-white/[0.05] font-display text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 font-medium">{e.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{e.sets} × {e.reps}</span>
                    <span className="hidden w-16 text-right text-sm tabular-nums text-muted-foreground sm:block">{e.restSec}s rest</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled><Lock /> Start workout</Button>
                <p className="text-xs text-muted-foreground">Set-by-set tracking, rest timer and 3D demos arrive in Phases 4–5.</p>
              </div>
            </div>
          )}
        </Section>

        <Section title="Weekly progress">
          {loading || !data ? <Skeleton className="h-40" /> : (
            <div className="flex flex-col items-center gap-2 pt-1">
              <RateRing value={weekRate} label={`${data.week.workoutsCompleted} of ${data.week.workoutsPlanned} workouts`} size={132} />
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Nutrition today" description={t ? 'Against your daily targets' : 'Your trainer hasn’t set targets yet'} className="lg:col-span-2">
          {loading || !data || !c ? (
            <Skeleton className="h-52" />
          ) : !t ? (
            <EmptyState icon={Salad} title="No nutrition targets yet" description="Once your trainer saves your calorie and macro targets, your progress bars appear here." />
          ) : (
            <div className="space-y-4">
              <Macro label="Calories" value={c.calories} target={t.calories} unit="kcal" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Macro label="Protein" value={c.proteinG} target={t.proteinG} accent="bg-chart-1" />
                <Macro label="Carbohydrates" value={c.carbsG} target={t.carbsG} accent="bg-chart-2" />
                <Macro label="Fat" value={c.fatG} target={t.fatG} accent="bg-chart-3" />
                <Macro label="Fibre" value={c.fiberG} target={t.fiberG} accent="bg-chart-4" />
              </div>
            </div>
          )}
        </Section>
        <Section title="Habits" description="Today">
          {loading || !data ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-5">
              <Macro label="Water" value={data.habits.waterMl} target={t?.waterMl ?? null} unit="ml" accent="bg-chart-2" />
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="grid size-10 place-items-center rounded-md bg-chart-4/15 text-chart-4"><Moon className="size-5" /></span>
                <div><p className="text-sm font-medium">Last sleep</p><p className="text-sm text-muted-foreground">{data.habits.sleepHours == null ? 'Not logged yet' : `${data.habits.sleepHours} hours`}</p></div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Weight trend" description="Recent weigh-ins" className="lg:col-span-2">
          {loading || !data ? <Skeleton className="h-[200px]" /> : data.weightSeries.length < 2 ? (
            <EmptyState icon={TrendingDown} title="Not enough weigh-ins yet" description="Log your weight a couple of times and your trend will be drawn here." />
          ) : (
            <WeightLineChart data={data.weightSeries} />
          )}
        </Section>
        <Section title="From your trainer">
          {loading || !data ? <Skeleton className="h-40" /> : data.trainerMessages.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No messages yet" description="Feedback from your trainer will appear here." />
          ) : (
            <ul className="space-y-3">
              {data.trainerMessages.map((m) => (
                <li key={m.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-sm">
                  <p className="leading-relaxed">{m.body}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{timeAgo(m.at)} {!m.read && <Badge variant="primary">new</Badge>}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
