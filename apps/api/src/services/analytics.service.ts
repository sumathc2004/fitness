import { prisma } from '@gym/database';
import { daysAgo, isoDate, monthLabel, ratio, startOfMonthUTC, startOfWeekUTC, todayUTC } from '../lib/dates';
import { assessClients } from './attention.service';

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const pct = (r: number | null) => (r == null ? null : Math.round(r * 100));

async function workoutRate(clientIds: string[] | null, from: Date) {
  const base = { ...(clientIds ? { clientId: { in: clientIds } } : { clientId: { not: null } }), isTemplate: false, status: { not: 'DRAFT' as const }, scheduledDate: { gte: from, lte: todayUTC() } };
  const [planned, done] = await Promise.all([prisma.workout.count({ where: base }), prisma.workout.count({ where: { ...base, status: 'COMPLETED' } })]);
  return { planned, done, rate: pct(ratio(done, planned)) };
}

async function attentionMix(clientIds: string[]) {
  const a = await assessClients(clientIds);
  return { good: a.filter((x) => x.level === 'GOOD' || x.level === 'NEW').length, monitor: a.filter((x) => x.level === 'MONITOR').length, attention: a.filter((x) => x.level === 'ATTENTION').length };
}

async function goalMix(clientIds: string[] | null) {
  const rows = await prisma.bodyProfile.groupBy({ by: ['goal'], _count: true, where: clientIds ? { clientId: { in: clientIds } } : {} });
  return rows.map((r) => ({ goal: r.goal ?? 'UNSET', count: r._count }));
}

async function weeklyAttendance(clientIds: string[] | null, weeks = 8) {
  const out: Array<{ week: string; checkIns: number }> = [];
  const thisWeek = startOfWeekUTC();
  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(thisWeek.getTime() - i * 7 * 86_400_000);
    const to = new Date(from.getTime() + 7 * 86_400_000);
    const checkIns = await prisma.attendance.count({ where: { ...(clientIds ? { clientId: { in: clientIds } } : {}), status: { in: ['PRESENT', 'LATE'] }, date: { gte: from, lt: to } } });
    out.push({ week: isoDate(from).slice(5), checkIns });
  }
  return out;
}

export async function adminAnalytics() {
  const months = Array.from({ length: 6 }, (_, i) => startOfMonthUTC(i - 5));
  const revenue = await Promise.all(months.map(async (m, i) => {
    const next = i === months.length - 1 ? startOfMonthUTC(1) : months[i + 1]!;
    const [paid, joined] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: m, lt: next } } }),
      prisma.client.count({ where: { joinedAt: { gte: m, lt: next } } }),
    ]);
    return { month: monthLabel(m), revenue: num(paid._sum.amount), newClients: joined };
  }));
  const clients = await prisma.client.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  const ids = clients.map((c) => c.id);
  const trainers = await prisma.trainer.findMany({ where: { user: { deletedAt: null } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, clients: { where: { endedAt: null }, select: { clientId: true } } } });
  const from30 = daysAgo(30);
  const perTrainer = await Promise.all(trainers.map(async (t) => {
    const cids = t.clients.map((c) => c.clientId);
    const w = await workoutRate(cids, from30);
    return { trainerId: t.id, name: `${t.user.firstName} ${t.user.lastName}`, clients: cids.length, workoutCompliance: w.rate };
  }));
  const [status, plans, overall] = await Promise.all([
    prisma.client.groupBy({ by: ['status'], _count: true }),
    prisma.subscription.groupBy({ by: ['membershipId'], _count: true, where: { status: 'ACTIVE' } }),
    workoutRate(null, from30),
  ]);
  const planNames = await prisma.membership.findMany({ select: { id: true, name: true } });
  return {
    revenueByMonth: revenue,
    clientStatus: status.map((s) => ({ status: s.status, count: s._count })),
    membershipMix: plans.map((p) => ({ plan: planNames.find((n) => n.id === p.membershipId)?.name ?? 'Plan', count: p._count })),
    goalMix: await goalMix(ids),
    attention: await attentionMix(ids),
    weeklyAttendance: await weeklyAttendance(null),
    trainerPerformance: perTrainer.sort((a, b) => (b.workoutCompliance ?? -1) - (a.workoutCompliance ?? -1)),
    workoutCompliance30d: overall,
  };
}

export async function trainerAnalytics(trainerId: string) {
  const links = await prisma.trainerClient.findMany({ where: { trainerId, endedAt: null }, select: { clientId: true, client: { select: { user: { select: { firstName: true, lastName: true } } } } } });
  const ids = links.map((l) => l.clientId);
  const from30 = daysAgo(30);
  const perClient = await Promise.all(links.map(async (l) => {
    const [w, d, att] = await Promise.all([
      workoutRate([l.clientId], from30),
      prisma.dietLog.findMany({ where: { clientId: l.clientId, date: { gte: from30, lte: todayUTC() } }, select: { status: true } }),
      prisma.attendance.count({ where: { clientId: l.clientId, status: { in: ['PRESENT', 'LATE'] }, date: { gte: from30 } } }),
    ]);
    return { clientId: l.clientId, name: `${l.client.user.firstName} ${l.client.user.lastName}`, workoutCompliance: w.rate, dietCompliance: pct(ratio(d.filter((x) => x.status === 'COMPLETED').length, d.length)), attendance30d: att };
  }));
  return {
    clients: ids.length,
    attention: await attentionMix(ids),
    goalMix: await goalMix(ids),
    weeklyAttendance: await weeklyAttendance(ids),
    workoutCompliance30d: await workoutRate(ids, from30),
    perClient: perClient.sort((a, b) => (a.workoutCompliance ?? 101) - (b.workoutCompliance ?? 101)),
  };
}
