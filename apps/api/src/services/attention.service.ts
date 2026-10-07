import { ATTENTION } from '@gym/config';
import { prisma } from '@gym/database';
import type { AttentionLevel, ClientAttention } from '@gym/types';
import { daysAgo, todayUTC } from '../lib/dates';

const DAY = 86_400_000;

export interface AttentionInput {
  now: Date;
  joinedAt: Date;
  lastActivityAt: Date | null;
  workoutsPlanned: number;
  workoutsCompleted: number;
  missedWorkouts: number;
  dietLogsTotal: number;
  dietLogsCompleted: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Pure scoring function behind the 🟢 GOOD / 🟡 MONITOR / 🔴 NEEDS ATTENTION badge.
 * Signals not yet available (weight trend, strength trend) are added in Phase 4 without changing the shape.
 */
export function assessClient(i: AttentionInput): { level: AttentionLevel; reasons: string[] } {
  const attention: string[] = [];
  const monitor: string[] = [];

  const sinceJoin = Math.floor((i.now.getTime() - i.joinedAt.getTime()) / DAY);
  const isNew = sinceJoin < ATTENTION.newClientGraceDays;
  const idleDays = Math.floor((i.now.getTime() - (i.lastActivityAt ?? i.joinedAt).getTime()) / DAY);

  if (!(isNew && !i.lastActivityAt)) {
    if (idleDays >= ATTENTION.inactiveDaysAttention) attention.push(i.lastActivityAt ? `No activity for ${idleDays} days` : 'No recent activity');
    else if (idleDays >= ATTENTION.inactiveDaysMonitor) monitor.push(`No activity for ${idleDays} days`);
  }

  if (i.missedWorkouts >= ATTENTION.missedWorkoutsAttention) attention.push(`${plural(i.missedWorkouts, 'missed workout')}`);
  else if (i.missedWorkouts >= ATTENTION.missedWorkoutsMonitor) monitor.push(`${plural(i.missedWorkouts, 'missed workout')}`);

  if (i.workoutsPlanned >= 2) {
    const r = i.workoutsCompleted / i.workoutsPlanned;
    if (r < ATTENTION.complianceAttentionBelow) attention.push(`Low workout completion (${pct(r)})`);
    else if (r < ATTENTION.complianceMonitorBelow) monitor.push(`Workout completion ${pct(r)}`);
  }

  if (i.dietLogsTotal >= 3) {
    const r = i.dietLogsCompleted / i.dietLogsTotal;
    if (r < ATTENTION.complianceAttentionBelow) attention.push('Low diet compliance');
    else if (r < ATTENTION.complianceMonitorBelow) monitor.push(`Diet compliance ${pct(r)}`);
  }

  if (attention.length) return { level: 'ATTENTION', reasons: [...attention, ...monitor] };
  if (monitor.length) return { level: 'MONITOR', reasons: monitor };
  return { level: isNew ? 'NEW' : 'GOOD', reasons: [] };
}

const severity: Record<AttentionLevel, number> = { ATTENTION: 0, MONITOR: 1, NEW: 2, GOOD: 3 };

/** Loads the signals for many clients in a handful of queries and scores each one. */
export async function assessClients(clientIds: string[]): Promise<ClientAttention[]> {
  if (clientIds.length === 0) return [];
  const now = new Date();
  const today = todayUTC();
  const from = daysAgo(ATTENTION.windowDays);

  const [clients, activity, workouts, dietLogs] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: clientIds }, status: 'ACTIVE', user: { status: 'ACTIVE', deletedAt: null } },
      select: { id: true, joinedAt: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.activityLog.groupBy({ by: ['clientId'], where: { clientId: { in: clientIds } }, _max: { createdAt: true } }),
    prisma.workout.findMany({
      where: { clientId: { in: clientIds }, isTemplate: false, status: { not: 'DRAFT' }, scheduledDate: { gte: from, lte: today } },
      select: { clientId: true, status: true, scheduledDate: true },
    }),
    prisma.dietLog.findMany({
      where: { clientId: { in: clientIds }, date: { gte: from, lte: today } },
      select: { clientId: true, status: true },
    }),
  ]);

  const last = new Map(activity.map((a) => [a.clientId, a._max.createdAt]));
  const out: ClientAttention[] = clients.map((c) => {
    const mine = workouts.filter((w) => w.clientId === c.id);
    const meals = dietLogs.filter((d) => d.clientId === c.id);
    const lastActivityAt = last.get(c.id) ?? null;
    const { level, reasons } = assessClient({
      now,
      joinedAt: c.joinedAt,
      lastActivityAt,
      workoutsPlanned: mine.length,
      workoutsCompleted: mine.filter((w) => w.status === 'COMPLETED').length,
      missedWorkouts: mine.filter((w) => w.status !== 'COMPLETED' && w.scheduledDate && w.scheduledDate < today).length,
      dietLogsTotal: meals.length,
      dietLogsCompleted: meals.filter((d) => d.status === 'COMPLETED').length,
    });
    return { clientId: c.id, name: `${c.user.firstName} ${c.user.lastName}`, level, reasons, lastActivityAt: lastActivityAt?.toISOString() ?? null };
  });

  return out.sort((a, b) => severity[a.level] - severity[b.level] || a.name.localeCompare(b.name));
}
