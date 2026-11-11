'use client';

import { BarChart3, CalendarCheck, CreditCard, FileText, Ticket, UserCog, Users, Wallet } from 'lucide-react';
import type { AdminDashboard } from '@gym/types';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { inr } from '@/lib/utils';
import { CountUp, ErrorState } from '@/components/dashboard/primitives';
import { HomeHeader, HomeSkeleton, MainRow, MoreLink, Panel, pct, QuickAccess, Stat, StatRow, SummaryStrip, type QuickItem } from '@/components/dashboard/home';
import { AttentionRows } from '@/components/dashboard/people-list';
import { Badge } from '@/components/ui/misc';

/**
 * Admin home — the gym at a glance: four numbers, who needs attention + shortcuts, and this month's health.
 * Charts, ledgers and per-trainer tables live on Analytics, Payments and Reports.
 */

const QUICK: QuickItem[] = [
  { label: 'Clients', href: '/admin/clients', icon: Users },
  { label: 'Trainers', href: '/admin/trainers', icon: UserCog },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Memberships', href: '/admin/memberships', icon: Ticket },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Reports', href: '/admin/reports', icon: FileText },
];

const rate = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data, error, reload } = useApi<AdminDashboard>('/admin/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <HomeSkeleton />;

  const t = data.totals;
  const r = data.revenue;
  const delta = r.lastMonth > 0 ? (r.thisMonth - r.lastMonth) / r.lastMonth : null;

  return (
    <div className="space-y-5">
      <HomeHeader
        name={user?.firstName ?? 'Admin'}
        subtitle="your gym at a glance"
        badges={<>
          <Badge variant="primary"><Users className="size-3.5" /> {t.activeClients} active clients</Badge>
          <Badge><UserCog className="size-3.5" /> {t.trainers} trainers</Badge>
        </>}
      />

      <StatRow>
        <Stat icon={Users} label="Clients" value={<CountUp value={t.clients} />} progress={pct(t.activeClients, t.clients)} href="/admin/clients" />
        <Stat icon={UserCog} label="Trainers" value={<CountUp value={t.trainers} />} hint="On the team" />
        <Stat icon={CalendarCheck} label="Attendance today" value={<CountUp value={t.attendanceToday} />} progress={pct(t.attendanceToday, t.activeClients)} />
        <Stat icon={Wallet} label="Revenue this month" value={inr(r.thisMonth)} hint={delta == null ? 'Nothing last month to compare' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% vs last month`} />
      </StatRow>

      <MainRow
        main={
          <Panel title="Needs attention" action={<MoreLink href="/admin/clients">All clients</MoreLink>} className="h-full">
            <AttentionRows items={data.attention} base="/admin" limit={3} />
          </Panel>
        }
        side={<QuickAccess items={QUICK} />}
      />

      <SummaryStrip
        title="This month"
        href="/admin/analytics"
        linkLabel="Analytics"
        rows={[
          { label: 'Workout completion', value: rate(data.rates.workoutCompletion), percent: Math.round((data.rates.workoutCompletion ?? 0) * 100), bar: 'bg-primary' },
          { label: 'Diet compliance', value: rate(data.rates.dietCompliance), percent: Math.round((data.rates.dietCompliance ?? 0) * 100), bar: 'bg-chart-2' },
          {
            label: 'Active memberships', value: `${t.activeSubscriptions} / ${t.clients}`, percent: pct(t.activeSubscriptions, t.clients), bar: 'bg-chart-3',
            note: t.expiringSubscriptions > 0 ? `${t.expiringSubscriptions} expiring soon` : undefined,
          },
        ]}
      />
    </div>
  );
}
