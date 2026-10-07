import { prisma } from '@gym/database';
import type { ActivityType } from '@gym/database';
import type { ActivityItem, AdminDashboard, ClientDashboard, SeriesPoint, TrainerDashboard } from '@gym/types';
import { daysAgo, daysFromNow, isoDate, monthLabel, ratio, startOfDayUTC, startOfMonthUTC, startOfWeekUTC, todayUTC } from '../lib/dates';
import { notFound } from '../lib/errors';
import { assessClients } from './attention.service';

const ACTIVITY_TEXT: Record<ActivityType, string> = {
  WORKOUT_STARTED: 'started a workout',
  EXERCISE_COMPLETED: 'completed an exercise',
  EXERCISE_SKIPPED: 'skipped an exercise',
  WORKOUT_COMPLETED: 'completed a workout',
  MEAL_LOGGED: 'logged a meal',
  MEAL_SKIPPED: 'skipped a meal',
  WATER_LOGGED: 'logged water',
  SLEEP_LOGGED: 'logged sleep',
  WEIGHT_UPDATED: 'updated their weight',
  CHECKED_IN: 'checked in',
  CHECKED_OUT: 'checked out',
  MESSAGE_SENT: 'sent a message',
  PROGRESS_PHOTO_ADDED: 'added a progress photo',
  ASSESSMENT_CREATED: 'had a body assessment',
};

async function recentActivity(clientIds: string[] | null, take = 10): Promise<ActivityItem[]> {
  const rows = await prisma.activityLog.findMany({
    where: clientIds ? { clientId: { in: clientIds } } : { clientId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take,
    include: { client: { select: { user: { select: { firstName: true, lastName: true } } } } },
  });
  return rows.map((r) => {
    const name = r.client ? `${r.client.user.firstName} ${r.client.user.lastName}` : null;
    return {
      id: r.id,
      type: r.type,
      clientId: r.clientId,
      clientName: name,
      at: r.createdAt.toISOString(),
      summary: `${name ?? 'Someone'} ${ACTIVITY_TEXT[r.type]}`,
    };
  });
}

/** Completion + diet rates over a trailing window for a set of clients (null = no data, not 0%). */
async function complianceRates(clientIds: string[] | null, days = 30) {
  const from = daysAgo(days);
  const today = todayUTC();
  const clientFilter = clientIds ? { clientId: { in: clientIds } } : { clientId: { not: null } };
  const wBase = { ...clientFilter, isTemplate: false, status: { not: 'DRAFT' as const }, scheduledDate: { gte: from, lte: today } };
  const dBase = { ...(clientIds ? { clientId: { in: clientIds } } : {}), date: { gte: from, lte: today } };
  const [planned, completed, dietTotal, dietDone] = await Promise.all([
    prisma.workout.count({ where: wBase }),
    prisma.workout.count({ where: { ...wBase, status: 'COMPLETED' } }),
    prisma.dietLog.count({ where: dBase }),
    prisma.dietLog.count({ where: { ...dBase, status: 'COMPLETED' } }),
  ]);
  return { workout: ratio(completed, planned), diet: ratio(dietDone, dietTotal) };
}

const num = (d: { toString(): string } | null | undefined) => (d ? Number(d.toString()) : 0);

// ───────────────────────────────────────────────────────── Super Admin
export async function adminDashboard(): Promise<AdminDashboard> {
  const today = todayUTC();
  const thisMonth = startOfMonthUTC(0);
  const lastMonth = startOfMonthUTC(-1);
  const sixMonthsAgo = startOfMonthUTC(-5);
  const activeUser = { status: 'ACTIVE' as const, deletedAt: null };

  const [clients, activeClients, trainers, attendanceToday, activeSubs, expiringSubs, revThis, revLast, newClients, paid, allActive, trainerRows, workoutGroups, activity, rates] =
    await Promise.all([
      prisma.client.count({ where: { user: { deletedAt: null } } }),
      prisma.client.count({ where: { status: 'ACTIVE', user: activeUser } }),
      prisma.trainer.count({ where: { user: activeUser } }),
      prisma.attendance.count({ where: { date: today, status: { in: ['PRESENT', 'LATE'] } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gte: today } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gte: today, lte: daysFromNow(14) } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: thisMonth } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: lastMonth, lt: thisMonth } } }),
      prisma.client.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.payment.findMany({ where: { status: 'PAID', paidAt: { gte: sixMonthsAgo } }, select: { paidAt: true, amount: true } }),
      prisma.client.findMany({ where: { status: 'ACTIVE', user: activeUser }, select: { id: true } }),
      prisma.trainer.findMany({
        where: { user: activeUser },
        select: { id: true, user: { select: { firstName: true, lastName: true } }, clients: { where: { endedAt: null }, select: { clientId: true } } },
      }),
      prisma.workout.groupBy({
        by: ['trainerId', 'status'],
        where: { isTemplate: false, clientId: { not: null }, status: { not: 'DRAFT' }, scheduledDate: { gte: daysAgo(30), lte: today } },
        _count: { _all: true },
      }),
      recentActivity(null, 10),
      complianceRates(null, 30),
    ]);

  const attentionAll = await assessClients(allActive.map((c) => c.id));
  const byId = new Map(attentionAll.map((a) => [a.clientId, a]));

  const months = Array.from({ length: 6 }, (_, k) => startOfMonthUTC(k - 5));
  const bucket = (date: Date | null) => (date ? months.findIndex((m) => date >= m && date < startOfMonthUTC(1, m)) : -1);
  const clientSeries: SeriesPoint[] = months.map((m) => ({ label: monthLabel(m), value: 0 }));
  const revenueSeries: SeriesPoint[] = months.map((m) => ({ label: monthLabel(m), value: 0 }));
  for (const c of newClients) { const i = bucket(c.createdAt); if (i >= 0) clientSeries[i]!.value += 1; }
  for (const p of paid) { const i = bucket(p.paidAt); if (i >= 0) revenueSeries[i]!.value += num(p.amount); }

  return {
    generatedAt: new Date().toISOString(),
    totals: { clients, activeClients, trainers, attendanceToday, activeSubscriptions: activeSubs, expiringSubscriptions: expiringSubs },
    rates: { workoutCompletion: rates.workout, dietCompliance: rates.diet },
    revenue: { thisMonth: num(revThis._sum.amount), lastMonth: num(revLast._sum.amount), currency: 'INR' },
    growth: { clients: clientSeries, revenue: revenueSeries },
    attention: attentionAll.filter((a) => a.level === 'ATTENTION' || a.level === 'MONITOR').slice(0, 8),
    trainerPerformance: trainerRows
      .map((t) => {
        const planned = workoutGroups.filter((g) => g.trainerId === t.id).reduce((s, g) => s + g._count._all, 0);
        const done = workoutGroups.filter((g) => g.trainerId === t.id && g.status === 'COMPLETED').reduce((s, g) => s + g._count._all, 0);
        return {
          trainerId: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`,
          clients: t.clients.length,
          workoutCompletion: ratio(done, planned),
          needAttention: t.clients.filter((c) => byId.get(c.clientId)?.level === 'ATTENTION').length,
        };
      })
      .sort((a, b) => b.clients - a.clients),
    recentActivity: activity,
  };
}

// ───────────────────────────────────────────────────────── Trainer
export async function trainerDashboard(trainerId: string): Promise<TrainerDashboard> {
  const today = todayUTC();
  const links = await prisma.trainerClient.findMany({
    where: { trainerId, endedAt: null, client: { user: { deletedAt: null } } },
    select: { clientId: true },
  });
  const ids = links.map((l) => l.clientId);

  const [activeClients, attention, rates, schedule, activity] = await Promise.all([
    prisma.client.count({ where: { id: { in: ids }, status: 'ACTIVE', user: { status: 'ACTIVE' } } }),
    assessClients(ids),
    complianceRates(ids, 30),
    prisma.workout.findMany({
      where: { clientId: { in: ids }, isTemplate: false, scheduledDate: today, status: { not: 'DRAFT' } },
      select: { id: true, name: true, status: true, clientId: true, client: { select: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { exercises: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    recentActivity(ids, 10),
  ]);

  // Weight change over the last 30 days + workouts completed this week, per client.
  const [measurements, sessions] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where: { clientId: { in: ids }, weightKg: { not: null }, measuredAt: { gte: daysAgo(30) } },
      orderBy: { measuredAt: 'asc' },
      select: { clientId: true, weightKg: true },
    }),
    prisma.workoutSession.groupBy({
      by: ['clientId'],
      where: { clientId: { in: ids }, status: 'COMPLETED', startedAt: { gte: startOfWeekUTC() } },
      _count: { _all: true },
    }),
  ]);
  const names = new Map(attention.map((a) => [a.clientId, a.name]));
  const clientProgress = ids
    .filter((id) => names.has(id))
    .map((id) => {
      const w = measurements.filter((m) => m.clientId === id);
      const change = w.length >= 2 ? Math.round((w[w.length - 1]!.weightKg! - w[0]!.weightKg!) * 10) / 10 : null;
      return { clientId: id, name: names.get(id)!, weightChangeKg: change, workoutsThisWeek: sessions.find((s) => s.clientId === id)?._count._all ?? 0 };
    });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      assignedClients: ids.length,
      activeClients,
      needAttention: attention.filter((a) => a.level === 'ATTENTION').length,
      workoutsToday: schedule.length,
    },
    rates: { workoutCompliance: rates.workout, dietCompliance: rates.diet },
    attention: attention.filter((a) => a.level !== 'GOOD').slice(0, 8),
    todaysSchedule: schedule.map((w) => ({
      workoutId: w.id,
      name: w.name,
      clientId: w.clientId!,
      clientName: `${w.client!.user.firstName} ${w.client!.user.lastName}`,
      status: w.status,
      exerciseCount: w._count.exercises,
    })),
    clientProgress,
    recentActivity: activity,
  };
}

// ───────────────────────────────────────────────────────── Client
export async function clientDashboard(clientId: string): Promise<ClientDashboard> {
  const today = todayUTC();
  const weekStart = startOfWeekUTC();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      user: { select: { id: true, firstName: true } },
      bodyProfile: { select: { goal: true } },
      trainers: { where: { endedAt: null }, take: 1, select: { trainer: { select: { user: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  if (!client) throw notFound('Client profile not found');

  const [planned, completed, attendanceDays, todays, target, mealItems, water, sleep, weights, msgs, activityDays] = await Promise.all([
    prisma.workout.count({ where: { clientId, isTemplate: false, status: { not: 'DRAFT' }, scheduledDate: { gte: weekStart, lte: daysFromNow(6 - ((today.getUTCDay() + 6) % 7)) } } }),
    prisma.workout.count({ where: { clientId, isTemplate: false, status: 'COMPLETED', scheduledDate: { gte: weekStart, lte: today } } }),
    prisma.attendance.count({ where: { clientId, date: { gte: weekStart, lte: today }, status: { in: ['PRESENT', 'LATE'] } } }),
    prisma.workout.findFirst({
      where: { clientId, isTemplate: false, scheduledDate: today, status: { not: 'DRAFT' } },
      select: {
        id: true, name: true, status: true,
        exercises: { orderBy: { order: 'asc' }, select: { id: true, sets: true, reps: true, restSec: true, customName: true, exercise: { select: { name: true } } } },
      },
    }),
    prisma.nutritionTarget.findFirst({ where: { clientId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.mealLogItem.findMany({ where: { mealLog: { clientId, date: today, status: 'COMPLETED' } }, select: { calories: true, proteinG: true, carbsG: true, fatG: true, fiberG: true } }),
    prisma.waterLog.aggregate({ _sum: { amountMl: true }, where: { clientId, date: today } }),
    prisma.sleepLog.findFirst({ where: { clientId }, orderBy: { date: 'desc' }, select: { hours: true, date: true } }),
    prisma.bodyMeasurement.findMany({ where: { clientId, weightKg: { not: null } }, orderBy: { measuredAt: 'desc' }, take: 12, select: { measuredAt: true, weightKg: true } }),
    prisma.message.findMany({
      where: { recipientId: client.user.id, sender: { role: { name: 'TRAINER' } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, body: true, createdAt: true, readAt: true },
    }),
    prisma.activityLog.findMany({ where: { clientId, createdAt: { gte: daysAgo(60) } }, select: { createdAt: true } }),
  ]);

  // Streak = consecutive days with any activity, counting back from today (or yesterday if today is still empty).
  const active = new Set(activityDays.map((a) => isoDate(startOfDayUTC(a.createdAt))));
  let cursor = active.has(isoDate(today)) ? today : daysAgo(1);
  let streak = 0;
  while (active.has(isoDate(cursor)) && streak < 60) { streak += 1; cursor = daysAgo(1, cursor); }

  const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG') => Math.round(mealItems.reduce((s, i) => s + i[k], 0));
  const trainer = client.trainers[0]?.trainer.user;

  return {
    generatedAt: new Date().toISOString(),
    greetingName: client.user.firstName,
    goal: client.bodyProfile?.goal ?? null,
    trainerName: trainer ? `${trainer.firstName} ${trainer.lastName}` : null,
    week: { workoutsPlanned: planned, workoutsCompleted: completed, attendanceDays },
    streakDays: streak,
    todaysWorkout: todays
      ? {
          id: todays.id,
          name: todays.name,
          status: todays.status,
          exercises: todays.exercises.map((e) => ({ id: e.id, name: e.exercise?.name ?? e.customName ?? 'Exercise', sets: e.sets, reps: e.reps, restSec: e.restSec })),
        }
      : null,
    nutrition: {
      target: target ? { calories: target.calories, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG, fiberG: target.fiberG, waterMl: target.waterMl } : null,
      consumed: { calories: sum('calories'), proteinG: sum('proteinG'), carbsG: sum('carbsG'), fatG: sum('fatG'), fiberG: sum('fiberG') },
    },
    habits: { waterMl: water._sum.amountMl ?? 0, sleepHours: sleep?.hours ?? null },
    weightSeries: weights.reverse().map((w) => ({ date: isoDate(w.measuredAt), weightKg: w.weightKg! })),
    trainerMessages: msgs.map((m) => ({ id: m.id, body: m.body, at: m.createdAt.toISOString(), read: !!m.readAt })),
  };
}
