import type { Request } from 'express';
import { prisma } from '@gym/database';
import { isoDate, startOfDayUTC } from '../lib/dates';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { assertCanAccessClient } from './access.service';
import { logActivity } from './audit.service';

function ownClient(req: Request): string {
  const id = req.auth!.clientId;
  if (!id) throw forbidden('Only clients can log habits');
  return id;
}
function guardDate(d: string) {
  const date = dateOnly(d);
  if (date.getTime() > Date.now() + 86_400_000) throw badRequest('You can’t log a future day');
  return date;
}

export const HABITS = [
  { key: 'steps', label: 'Steps', unit: 'steps', target: 8000 },
  { key: 'protein', label: 'Hit protein goal', unit: null, target: null },
  { key: 'stretch', label: 'Mobility / stretching', unit: 'min', target: 10 },
] as const;

export async function addWater(req: Request, input: { date: string; amountMl: number }) {
  const clientId = ownClient(req);
  await prisma.waterLog.create({ data: { clientId, date: guardDate(input.date), amountMl: input.amountMl } });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'WATER_LOGGED' });
  return daySummary(req, clientId, input.date);
}

export async function removeWater(req: Request, id: string) {
  const clientId = ownClient(req);
  const w = await prisma.waterLog.findFirst({ where: { id, clientId } });
  if (!w) throw notFound('Entry not found');
  await prisma.waterLog.delete({ where: { id } });
  return daySummary(req, clientId, isoDate(w.date));
}

export async function setSleep(req: Request, input: { date: string; hours: number; quality?: number | null; notes?: string | null }) {
  const clientId = ownClient(req);
  const date = guardDate(input.date);
  await prisma.sleepLog.upsert({
    where: { clientId_date: { clientId, date } },
    update: { hours: input.hours, quality: input.quality ?? null, notes: input.notes ?? null },
    create: { clientId, date, hours: input.hours, quality: input.quality ?? null, notes: input.notes ?? null },
  });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'SLEEP_LOGGED' });
  return daySummary(req, clientId, input.date);
}

export async function setHabit(req: Request, input: { date: string; habitKey: string; completed?: boolean; value?: number | null }) {
  const clientId = ownClient(req);
  const h = HABITS.find((x) => x.key === input.habitKey);
  if (!h) throw badRequest('Unknown habit');
  const date = guardDate(input.date);
  const completed = input.completed ?? (h.target != null && input.value != null ? input.value >= h.target : false);
  await prisma.habitLog.upsert({
    where: { clientId_date_habitKey: { clientId, date, habitKey: h.key } },
    update: { completed, value: input.value ?? null },
    create: { clientId, date, habitKey: h.key, label: h.label, unit: h.unit, completed, value: input.value ?? null },
  });
  return daySummary(req, clientId, input.date);
}

export async function daySummary(req: Request, clientId: string, dateStr: string) {
  await assertCanAccessClient(req, clientId);
  const date = dateOnly(dateStr);
  const [water, sleep, habits, target] = await Promise.all([
    prisma.waterLog.findMany({ where: { clientId, date }, orderBy: { loggedAt: 'asc' } }),
    prisma.sleepLog.findUnique({ where: { clientId_date: { clientId, date } } }),
    prisma.habitLog.findMany({ where: { clientId, date } }),
    prisma.nutritionTarget.findFirst({ where: { clientId, isActive: true }, select: { waterMl: true } }),
  ]);
  const byKey = new Map(habits.map((h) => [h.habitKey, h]));
  return {
    date: dateStr,
    water: { totalMl: water.reduce((t, w) => t + w.amountMl, 0), targetMl: target?.waterMl ?? 2500, entries: water.map((w) => ({ id: w.id, amountMl: w.amountMl, at: w.loggedAt.toISOString() })) },
    sleep: sleep ? { hours: sleep.hours, quality: sleep.quality, notes: sleep.notes } : null,
    habits: HABITS.map((h) => ({ key: h.key, label: h.label, unit: h.unit, target: h.target, completed: byKey.get(h.key)?.completed ?? false, value: byKey.get(h.key)?.value ?? null })),
  };
}

export async function habitHistory(req: Request, clientId: string, days = 14) {
  await assertCanAccessClient(req, clientId);
  const from = new Date(startOfDayUTC().getTime() - (days - 1) * 86_400_000);
  const [water, sleep, habits] = await Promise.all([
    prisma.waterLog.findMany({ where: { clientId, date: { gte: from } } }),
    prisma.sleepLog.findMany({ where: { clientId, date: { gte: from } } }),
    prisma.habitLog.findMany({ where: { clientId, date: { gte: from }, habitKey: 'steps' } }),
  ]);
  const series = Array.from({ length: days }, (_, i) => isoDate(new Date(from.getTime() + i * 86_400_000)));
  return series.map((d) => ({
    date: d,
    waterMl: water.filter((w) => isoDate(w.date) === d).reduce((t, w) => t + w.amountMl, 0),
    sleepHours: sleep.find((s) => isoDate(s.date) === d)?.hours ?? null,
    steps: habits.find((h) => isoDate(h.date) === d)?.value ?? null,
  }));
}
