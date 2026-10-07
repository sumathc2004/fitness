'use client';

import { CalendarDays, Dumbbell, Flame, ShieldAlert, Users } from 'lucide-react';
import type { TrainerDashboard } from '@gym/types';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { pct } from '@/lib/utils';
import { Greeting, ActivityFeed, AttentionList, EmptyState, ErrorState, RateRing, Section, StatCard, StatCardSkeleton } from '@/components/dashboard/primitives';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';

const statusVariant: Record<string, 'good' | 'monitor' | 'muted' | 'primary'> = { COMPLETED: 'good', IN_PROGRESS: 'primary', ASSIGNED: 'muted', SKIPPED: 'monitor' };

export default function TrainerDashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<TrainerDashboard>('/trainers/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground"><Greeting />{user ? `, ${user.firstName}` : ''}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight">Your clients today</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label="Assigned clients" value={data.totals.assignedClients} icon={Users} tone="primary" />
            <StatCard index={1} label="Active clients" value={data.totals.activeClients} icon={Flame} />
            <StatCard index={2} label="Need attention" value={data.totals.needAttention} icon={ShieldAlert} tone="attention" hint="Flagged red" />
            <StatCard index={3} label="Workouts today" value={data.totals.workoutsToday} icon={CalendarDays} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Today’s schedule" description="Workouts assigned for today" className="lg:col-span-2">
          {loading || !data ? (
            <Skeleton className="h-40" />
          ) : data.todaysSchedule.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Nothing scheduled today" description="Workouts you assign to clients for today will show up here." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.todaysSchedule.map((w) => (
                <li key={w.workoutId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={w.clientName} size={38} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{w.name}</p><p className="text-sm text-muted-foreground">{w.clientName} · {w.exerciseCount} exercises</p></div>
                  <Badge variant={statusVariant[w.status] ?? 'muted'}>{w.status.replace('_', ' ').toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Compliance" description="Your clients, last 30 days">
          {loading || !data ? (
            <Skeleton className="h-[160px]" />
          ) : (
            <div className="flex items-start justify-around pt-2">
              <RateRing value={data.rates.workoutCompliance} label="Workouts" size={104} />
              <RateRing value={data.rates.dietCompliance} label="Diet" size={104} />
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Clients needing attention" description="Most urgent first">
          {loading || !data ? <Skeleton className="h-48" /> : <AttentionList items={data.attention} emptyText="All of your clients are on track." />}
        </Section>
        <Section title="Client progress" description="Weight change (30 days) and workouts this week">
          {loading || !data ? (
            <Skeleton className="h-48" />
          ) : data.clientProgress.length === 0 ? (
            <EmptyState icon={Users} title="No clients yet" description="Assigned clients and their progress will appear here." />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.clientProgress.map((c) => (
                <li key={c.clientId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={c.name} size={34} />
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{c.workoutsThisWeek} workouts</span>
                  <span className={`w-16 text-right text-sm font-semibold tabular-nums ${c.weightChangeKg == null ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {c.weightChangeKg == null ? '—' : `${c.weightChangeKg > 0 ? '+' : ''}${c.weightChangeKg} kg`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent activity" description="What your clients have been up to">
        {loading || !data ? <Skeleton className="h-40" /> : <ActivityFeed items={data.recentActivity} />}
      </Section>
      <p className="text-center text-xs text-muted-foreground/70">Compliance {pct(data?.rates.workoutCompliance ?? null)} workouts · {pct(data?.rates.dietCompliance ?? null)} diet</p>
    </div>
  );
}
