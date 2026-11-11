'use client';

import { CalendarDays, Dumbbell, Flame, LineChart, MessageSquare, ShieldAlert, Users, Utensils } from 'lucide-react';
import type { TrainerDashboard } from '@gym/types';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { CountUp, ErrorState } from '@/components/dashboard/primitives';
import { HomeHeader, HomeSkeleton, MainRow, MoreLink, Panel, pct, QuickAccess, Stat, StatRow, SummaryStrip, type QuickItem } from '@/components/dashboard/home';
import { EmptyLine, PersonRow } from '@/components/dashboard/people-list';
import { Badge } from '@/components/ui/misc';

/**
 * Trainer home — same shape as the client's: four numbers, today's sessions + shortcuts, one summary strip.
 * Full lists and charts live on My Clients, Calendar and Progress.
 */

const QUICK: QuickItem[] = [
  { label: 'My Clients', href: '/trainer/clients', icon: Users },
  { label: 'Workout Builder', href: '/trainer/workout-builder', icon: Dumbbell },
  { label: 'Calendar', href: '/trainer/workout-calendar', icon: CalendarDays },
  { label: 'Diet Builder', href: '/trainer/diet-builder', icon: Utensils },
  { label: 'Progress', href: '/trainer/progress', icon: LineChart },
  { label: 'Messages', href: '/trainer/messages', icon: MessageSquare },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  ASSIGNED: { label: 'Scheduled', tone: 'bg-white/[0.06] text-muted-foreground' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-primary/15 text-primary' },
  COMPLETED: { label: 'Done', tone: 'bg-good/15 text-good' },
  SKIPPED: { label: 'Skipped', tone: 'bg-monitor/15 text-monitor' },
};

const rate = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export default function TrainerDashboardPage() {
  const { user } = useAuth();
  const { data, error, reload } = useApi<TrainerDashboard>('/trainers/dashboard');
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <HomeSkeleton />;

  const t = data.totals;
  const schedule = data.todaysSchedule;
  const done = schedule.filter((s) => s.status === 'COMPLETED').length;
  const SHOW = 3;

  return (
    <div className="space-y-5">
      <HomeHeader
        name={user?.firstName ?? 'Coach'}
        subtitle="your clients today"
        badges={<Badge variant="primary"><Users className="size-3.5" /> {t.assignedClients} {t.assignedClients === 1 ? 'client' : 'clients'}</Badge>}
      />

      <StatRow>
        <Stat icon={Users} label="Assigned clients" value={<CountUp value={t.assignedClients} />} hint={`${t.activeClients} active`} />
        <Stat icon={Flame} label="Active clients" value={<CountUp value={t.activeClients} />} progress={pct(t.activeClients, t.assignedClients)} />
        <Stat icon={ShieldAlert} label="Need attention" value={<CountUp value={t.needAttention} />} tone={t.needAttention > 0 ? 'attention' : 'primary'} hint={t.needAttention > 0 ? 'Flagged red · view list' : 'All on track'} href="/trainer/clients" />
        <Stat icon={CalendarDays} label="Workouts today" value={`${done}/${t.workoutsToday}`} progress={pct(done, t.workoutsToday)} />
      </StatRow>

      <MainRow
        main={
          <Panel title="Today’s sessions" action={<MoreLink href="/trainer/workout-calendar">Calendar</MoreLink>} className="h-full">
            {schedule.length === 0 ? <EmptyLine icon={CalendarDays} text="No workouts scheduled today." /> : (
              <>
                <ul className="-mx-2 space-y-0.5">
                  {schedule.slice(0, SHOW).map((s) => {
                    const st = STATUS[s.status] ?? STATUS.ASSIGNED!;
                    return <PersonRow key={s.workoutId} name={s.clientName} detail={`${s.name} · ${s.exerciseCount} exercises`} tag={st.label} tagTone={st.tone} href={`/trainer/clients/${s.clientId}`} />;
                  })}
                </ul>
                {schedule.length > SHOW && <p className="mt-2 px-2 text-xs text-muted-foreground">+{schedule.length - SHOW} more on the calendar</p>}
              </>
            )}
          </Panel>
        }
        side={<QuickAccess items={QUICK} />}
      />

      <SummaryStrip
        title="Compliance · last 30 days"
        href="/trainer/progress"
        linkLabel="Progress"
        rows={[
          { label: 'Workouts', value: rate(data.rates.workoutCompliance), percent: Math.round((data.rates.workoutCompliance ?? 0) * 100), bar: 'bg-primary' },
          { label: 'Diet', value: rate(data.rates.dietCompliance), percent: Math.round((data.rates.dietCompliance ?? 0) * 100), bar: 'bg-chart-2' },
          {
            label: 'Clients on track', value: `${t.assignedClients - t.needAttention} / ${t.assignedClients}`, percent: pct(t.assignedClients - t.needAttention, t.assignedClients), bar: 'bg-good',
            note: t.needAttention > 0 ? `${t.needAttention} need attention` : undefined,
          },
        ]}
      />
    </div>
  );
}
