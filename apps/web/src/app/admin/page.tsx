'use client';

import { Activity, CalendarCheck, CreditCard, Dumbbell, Ticket, UserCog, Users, Wallet } from 'lucide-react';
import type { AdminDashboard } from '@gym/types';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { inr, pct } from '@/lib/utils';
import { Greeting, ActivityFeed, AttentionList, ErrorState, RateRing, Section, StatCard, StatCardSkeleton } from '@/components/dashboard/primitives';
import { GrowthAreaChart, SimpleBarChart } from '@/components/dashboard/charts';
import { Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/misc';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<AdminDashboard>('/admin/dashboard');

  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const delta = data && data.revenue.lastMonth > 0 ? (data.revenue.thisMonth - data.revenue.lastMonth) / data.revenue.lastMonth : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground"><Greeting />{user ? `, ${user.firstName}` : ''}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight">Your gym, at a glance</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 8 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label="Total clients" value={data.totals.clients} icon={Users} hint={`${data.totals.activeClients} active`} tone="primary" />
            <StatCard index={1} label="Trainers" value={data.totals.trainers} icon={UserCog} />
            <StatCard index={2} label="Attendance today" value={data.totals.attendanceToday} icon={CalendarCheck} hint="Present or late" />
            <StatCard index={3} label="Active memberships" value={data.totals.activeSubscriptions} icon={Ticket} hint={`${data.totals.expiringSubscriptions} expiring in 14 days`} />
            <StatCard index={4} label="Revenue this month" value={inr(data.revenue.thisMonth)} icon={Wallet} hint={delta == null ? 'No revenue last month to compare' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% vs last month`} />
            <StatCard index={5} label="Workout completion" value={pct(data.rates.workoutCompletion)} icon={Dumbbell} hint="Last 30 days" />
            <StatCard index={6} label="Diet compliance" value={pct(data.rates.dietCompliance)} icon={Activity} hint="Last 30 days" />
            <StatCard index={7} label="Needing attention" value={data.attention.filter((a) => a.level === 'ATTENTION').length} icon={CreditCard} tone="attention" hint="Clients flagged red" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Client growth" description="New clients per month" className="lg:col-span-2">
          {loading || !data ? <Skeleton className="h-[220px]" /> : <GrowthAreaChart data={data.growth.clients} id="clients" />}
        </Section>
        <Section title="Compliance" description="Trailing 30 days">
          {loading || !data ? (
            <Skeleton className="h-[160px]" />
          ) : (
            <div className="flex items-start justify-around pt-2">
              <RateRing value={data.rates.workoutCompletion} label="Workouts" size={104} />
              <RateRing value={data.rates.dietCompliance} label="Diet" size={104} />
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Revenue" description={`Last 6 months · ${data?.revenue.currency ?? 'INR'}`}>
            {loading || !data ? <Skeleton className="h-[220px]" /> : <SimpleBarChart data={data.growth.revenue} fmt={inr} />}
          </Section>
          <Section title="Trainer performance" description="Workout completion across each trainer’s clients (30 days)">
            {loading || !data ? (
              <Skeleton className="h-40" />
            ) : data.trainerPerformance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No trainers yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Trainer</th><th className="pb-2 font-medium">Clients</th><th className="pb-2 font-medium">Completion</th><th className="pb-2 font-medium">Red flags</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {data.trainerPerformance.map((t) => (
                      <tr key={t.trainerId}>
                        <td className="py-3 font-medium">{t.name}</td>
                        <td className="py-3 tabular-nums">{t.clients}</td>
                        <td className="py-3 tabular-nums">{pct(t.workoutCompletion)}</td>
                        <td className="py-3">{t.needAttention > 0 ? <Badge variant="attention">{t.needAttention}</Badge> : <Badge variant="good">0</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
        <Section title="Clients needing attention" description="Red and yellow, most urgent first">
          {loading || !data ? <Skeleton className="h-[220px]" /> : <AttentionList items={data.attention} />}
        </Section>
      </div>

      <Section title="Recent activity" description="Latest client actions across the gym">
        {loading || !data ? <Skeleton className="h-40" /> : <ActivityFeed items={data.recentActivity} />}
      </Section>
    </div>
  );
}
