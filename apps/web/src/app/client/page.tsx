'use client';

import Link from 'next/link';
import { Droplets, Dumbbell, Flame, MessageSquare, Moon, Play, Salad, Target, TrendingDown } from 'lucide-react';
import type { ClientDashboard } from '@gym/types';
import { useApi } from '@/lib/use-api';
import { timeAgo } from '@/lib/utils';
import { Greeting, EmptyState, ErrorState, RateRing, Section, StatCard, StatCardSkeleton } from '@/components/dashboard/primitives';
import { WeightLineChart } from '@/components/dashboard/charts';
import { buttonVariants } from '@/components/ui/button';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';

/** Empty states fill their (fixed-height) card instead of using the tall default padding. */
const EMPTY = 'min-h-full gap-2 px-4 py-4';

const GOAL: Record<string, string> ={ FAT_LOSS: 'Fat loss', RECOMPOSITION: 'Recomposition', MUSCLE_BUILDING: 'Muscle building' };

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

  // On xl screens the whole dashboard fits one viewport: 100dvh minus the 4rem header and the shell's 2×2rem padding.
  // Cards get fixed grid cells and scroll internally if their content is taller; smaller screens scroll normally.
  return (
    <div className="flex flex-col gap-4 xl:h-[calc(100dvh-8rem)] xl:min-h-[600px]">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground"><Greeting /></p>
          <h2 className="font-display text-2xl font-bold tracking-tight">{data ? `${data.greetingName}, here’s your day` : <Skeleton className="h-8 w-72" />}</h2>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary"><Target className="size-3.5" /> {data.goal ? GOAL[data.goal] : 'No goal set yet'}</Badge>
            {data.trainerName && <Badge>Coach {data.trainerName}</Badge>}
          </div>
        )}
      </div>

      <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard compact index={0} label="Workout streak" value={data.streakDays} suffix={data.streakDays === 1 ? 'day' : 'days'} icon={Flame} tone="primary" hint="Consecutive active days" />
            <StatCard compact index={1} label="This week" value={`${data.week.workoutsCompleted}/${data.week.workoutsPlanned}`} icon={Dumbbell} hint="Workouts completed" />
            <StatCard compact index={2} label="Check-ins" value={data.week.attendanceDays} suffix="this week" icon={Target} hint="Days at the gym" />
            <StatCard compact index={3} label="Water today" value={data.habits.waterMl} suffix="ml" icon={Droplets} hint={t?.waterMl ? `Target ${t.waterMl.toLocaleString('en-IN')} ml` : 'No target set yet'} />
          </>
        )}
      </div>

      {/* xl: 4 columns × 2 rows that share the remaining height.  Row 1: workout (2) · weekly · habits.  Row 2: nutrition (2) · weight · trainer. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-4 xl:grid-rows-2">
        <Section fill title="Today’s workout" description={data?.todaysWorkout ? data.todaysWorkout.name : 'Planned by your trainer'} className="sm:col-span-2"
          action={data?.todaysWorkout ? (
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="muted">{data.todaysWorkout.exercises.length} exercises</Badge>
              <Link href="/client/workout" className={buttonVariants({ size: 'sm' })}><Play /> Start workout</Link>
            </div>
          ) : undefined}>
          {loading || !data ? (
            <Skeleton className="h-full min-h-40" />
          ) : !data.todaysWorkout ? (
            <EmptyState className={EMPTY} icon={Dumbbell} title="No workout today" description="Rest up, or message your trainer if you were expecting a session." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.todaysWorkout.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.05] font-display text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{e.sets} × {e.reps}</span>
                  <span className="hidden w-16 text-right text-sm tabular-nums text-muted-foreground sm:block">{e.restSec}s rest</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section fill title="Weekly progress">
          {loading || !data ? <Skeleton className="h-full min-h-32" /> : (
            <div className="flex h-full items-center justify-center">
              <RateRing value={weekRate} label={`${data.week.workoutsCompleted} of ${data.week.workoutsPlanned} workouts`} size={116} />
            </div>
          )}
        </Section>

        <Section fill title="Habits" description="Today">
          {loading || !data ? (
            <Skeleton className="h-full min-h-32" />
          ) : (
            <div className="space-y-4">
              <Macro label="Water" value={data.habits.waterMl} target={t?.waterMl ?? null} unit="ml" accent="bg-chart-2" />
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-chart-4/15 text-chart-4"><Moon className="size-5" /></span>
                <div><p className="text-sm font-medium">Last sleep</p><p className="text-sm text-muted-foreground">{data.habits.sleepHours == null ? 'Not logged yet' : `${data.habits.sleepHours} hours`}</p></div>
              </div>
            </div>
          )}
        </Section>

        <Section fill title="Nutrition today" description={t ? 'Against your daily targets' : 'Your trainer hasn’t set targets yet'} className="sm:col-span-2">
          {loading || !data || !c ? (
            <Skeleton className="h-full min-h-40" />
          ) : !t ? (
            <EmptyState className={EMPTY} icon={Salad} title="No nutrition targets yet" description="Once your trainer saves your calorie and macro targets, your progress bars appear here." />
          ) : (
            <div className="space-y-3">
              <Macro label="Calories" value={c.calories} target={t.calories} unit="kcal" />
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Macro label="Protein" value={c.proteinG} target={t.proteinG} accent="bg-chart-1" />
                <Macro label="Carbohydrates" value={c.carbsG} target={t.carbsG} accent="bg-chart-2" />
                <Macro label="Fat" value={c.fatG} target={t.fatG} accent="bg-chart-3" />
                <Macro label="Fibre" value={c.fiberG} target={t.fiberG} accent="bg-chart-4" />
              </div>
            </div>
          )}
        </Section>

        <Section fill title="Weight trend" description="Recent weigh-ins">
          {loading || !data ? <Skeleton className="h-full min-h-40" /> : data.weightSeries.length < 2 ? (
            <EmptyState className={EMPTY} icon={TrendingDown} title="Not enough weigh-ins yet" description="Log your weight a couple of times and your trend will be drawn here." />
          ) : (
            <div className="h-[200px] xl:h-full xl:min-h-[120px]"><WeightLineChart data={data.weightSeries} height="100%" /></div>
          )}
        </Section>

        <Section fill title="From your trainer">
          {loading || !data ? <Skeleton className="h-full min-h-32" /> : data.trainerMessages.length === 0 ? (
            <EmptyState className={EMPTY} icon={MessageSquare} title="No messages yet" description="Feedback from your trainer will appear here." />
          ) : (
            <ul className="space-y-2">
              {data.trainerMessages.map((m) => (
                <li key={m.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2.5 text-sm">
                  <p className="leading-snug">{m.body}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">{timeAgo(m.at)} {!m.read && <Badge variant="primary">new</Badge>}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
