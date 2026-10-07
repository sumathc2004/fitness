import { prisma } from '@gym/database';
import { daysAgo, daysFromNow, isoDate, startOfDayUTC, todayUTC } from '../lib/dates';
import { logger } from '../lib/logger';
import { notify, trainerUserIdsOf } from './notification.service';

/** Creates a notification only if the same (user, type, key) wasn't already sent today. */
async function notifyOnce(userId: string, type: Parameters<typeof notify>[0]['type'], key: string, title: string, body: string) {
  const since = startOfDayUTC();
  const dup = await prisma.notification.findFirst({ where: { userId, type, createdAt: { gte: since }, data: { path: '$.key', equals: key } }, select: { id: true } });
  if (dup) return false;
  await notify({ userId, type, title, body, data: { key } });
  return true;
}

/** Idempotent reminder sweep — safe to run any number of times a day. */
export async function runReminders(): Promise<Record<string, number>> {
  const out = { missedWorkout: 0, membershipExpiry: 0, paymentReminder: 0, workoutReminder: 0 };
  const today = todayUTC();

  // Workouts scheduled yesterday (or earlier this week) still unfinished → tell client and trainer.
  const missed = await prisma.workout.findMany({
    where: { isTemplate: false, status: 'ASSIGNED', scheduledDate: { gte: daysAgo(2), lt: today }, clientId: { not: null } },
    select: { id: true, name: true, scheduledDate: true, client: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } } },
  });
  for (const w of missed) {
    if (!w.client) continue;
    const key = `missed:${w.id}`;
    if (await notifyOnce(w.client.userId, 'MISSED_WORKOUT', key, 'You missed a workout', `${w.name} was scheduled for ${isoDate(w.scheduledDate!)}. Do it today if you can.`)) {
      out.missedWorkout++;
      for (const t of await trainerUserIdsOf(w.client.id)) await notifyOnce(t, 'MISSED_WORKOUT', key, 'Client missed a workout', `${w.client.user.firstName} ${w.client.user.lastName} missed “${w.name}”.`);
    }
  }

  // Today's workouts → reminder.
  const todays = await prisma.workout.findMany({ where: { isTemplate: false, status: 'ASSIGNED', scheduledDate: today, clientId: { not: null } }, select: { id: true, name: true, client: { select: { userId: true } } } });
  for (const w of todays) if (w.client && (await notifyOnce(w.client.userId, 'WORKOUT_REMINDER', `today:${w.id}`, 'Workout today', `${w.name} is on your plan today.`))) out.workoutReminder++;

  // Memberships ending within 7 days.
  const expiring = await prisma.subscription.findMany({ where: { status: 'ACTIVE', endDate: { gte: today, lte: daysFromNow(7) } }, select: { id: true, endDate: true, membership: { select: { name: true } }, client: { select: { userId: true } } } });
  for (const s of expiring) if (await notifyOnce(s.client.userId, 'MEMBERSHIP_EXPIRY', `exp:${s.id}`, 'Membership expiring soon', `Your ${s.membership.name} plan ends on ${isoDate(s.endDate)}.`)) out.membershipExpiry++;

  // Flip lapsed subscriptions.
  await prisma.subscription.updateMany({ where: { status: 'ACTIVE', endDate: { lt: today } }, data: { status: 'EXPIRED' } });

  // Unpaid payments past their due date.
  const due = await prisma.payment.findMany({ where: { status: 'PENDING', dueDate: { lte: today } }, select: { id: true, amount: true, currency: true, client: { select: { userId: true } } } });
  for (const p of due) if (await notifyOnce(p.client.userId, 'PAYMENT_REMINDER', `pay:${p.id}`, 'Payment due', `A payment of ${p.currency} ${p.amount.toString()} is outstanding.`)) out.paymentReminder++;

  return out;
}

export function startScheduler(): NodeJS.Timeout {
  const run = () => runReminders().then((r) => logger.info(r, 'reminder sweep done')).catch((err) => logger.error({ err }, 'reminder sweep failed'));
  setTimeout(run, 15_000).unref();
  const t = setInterval(run, 60 * 60 * 1000);
  t.unref();
  return t;
}
