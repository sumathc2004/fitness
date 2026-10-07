import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { DailyMealDto, DailyNutritionDto, Macros, MealLogInput } from '@gym/types';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { assertCanAccessClient } from './access.service';
import { logActivity } from './audit.service';
import { activePlanOf, addMacros, zero } from './diet.service';

const r1 = (n: number) => Math.round(n * 10) / 10;

function ownClient(req: Request): string {
  const id = req.auth!.clientId;
  if (!id) throw forbidden('Only clients can log meals');
  return id;
}

/** Marks a planned meal completed / skipped for a day. Completing it also records what was eaten (copied from the plan). */
export async function setDietLog(req: Request, input: { dietMealId: string; date: string; status: 'COMPLETED' | 'SKIPPED' | 'PENDING' }) {
  const clientId = ownClient(req);
  const meal = await prisma.dietMeal.findFirst({ where: { id: input.dietMealId, plan: { clientId, isTemplate: false, status: 'ACTIVE' } }, include: { items: true } });
  if (!meal) throw notFound('That meal is not part of your active plan');
  const date = dateOnly(input.date);
  if (date.getTime() > Date.now() + 86_400_000) throw badRequest('You can’t log a future day');
  await prisma.$transaction(async (tx) => {
    await tx.dietLog.upsert({
      where: { clientId_dietMealId_date: { clientId, dietMealId: meal.id, date } },
      update: { status: input.status, loggedAt: input.status === 'PENDING' ? null : new Date() },
      create: { clientId, dietMealId: meal.id, date, status: input.status, loggedAt: input.status === 'PENDING' ? null : new Date() },
    });
    await tx.mealLog.deleteMany({ where: { clientId, dietMealId: meal.id, date } });
    if (input.status === 'COMPLETED') {
      await tx.mealLog.create({
        data: {
          clientId, date, mealType: meal.mealType, dietMealId: meal.id, status: 'COMPLETED',
          items: { create: meal.items.map((i) => ({ foodItemId: i.foodItemId, foodServingId: i.foodServingId, customName: i.customName, quantity: i.quantity, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG })) },
        },
      });
    }
  });
  if (input.status === 'COMPLETED') await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'MEAL_LOGGED', entityType: 'DietMeal', entityId: meal.id });
  if (input.status === 'SKIPPED') await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'MEAL_SKIPPED', entityType: 'DietMeal', entityId: meal.id });
  return getDailyNutrition(req, clientId, input.date);
}

/** A meal that isn't in the plan (restaurant meal, extra snack…). */
export async function logCustomMeal(req: Request, input: MealLogInput) {
  const clientId = ownClient(req);
  const ids = [...new Set(input.items.map((i) => i.foodServingId).filter((x): x is string => !!x))];
  const servings = ids.length ? await prisma.foodServing.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(servings.map((s) => [s.id, s]));
  const items = input.items.map((i) => {
    if (i.foodServingId) {
      const s = byId.get(i.foodServingId);
      if (!s) throw badRequest('One of the selected foods no longer exists');
      return { foodItemId: s.foodItemId, foodServingId: s.id, customName: null as string | null, quantity: i.quantity, calories: Math.round(s.calories * i.quantity), proteinG: r1(s.proteinG * i.quantity), carbsG: r1(s.carbsG * i.quantity), fatG: r1(s.fatG * i.quantity), fiberG: r1(s.fiberG * i.quantity) };
    }
    return { foodItemId: null, foodServingId: null, customName: i.customName ?? 'Custom food', quantity: i.quantity, calories: Math.round(i.calories ?? 0), proteinG: i.proteinG ?? 0, carbsG: i.carbsG ?? 0, fatG: i.fatG ?? 0, fiberG: i.fiberG ?? 0 };
  });
  const log = await prisma.mealLog.create({ data: { clientId, date: dateOnly(input.date), mealType: input.mealType, notes: input.notes, status: 'COMPLETED', items: { create: items } } });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'MEAL_LOGGED', entityType: 'MealLog', entityId: log.id });
  return getDailyNutrition(req, clientId, input.date);
}

export async function deleteCustomMeal(req: Request, id: string) {
  const clientId = ownClient(req);
  const m = await prisma.mealLog.findFirst({ where: { id, clientId, dietMealId: null }, select: { id: true, date: true } });
  if (!m) throw notFound('Meal not found');
  await prisma.mealLog.delete({ where: { id } });
  return getDailyNutrition(req, clientId, m.date.toISOString().slice(0, 10));
}

export async function getDailyNutrition(req: Request, clientId: string, dateStr: string): Promise<DailyNutritionDto> {
  await assertCanAccessClient(req, clientId);
  const date = dateOnly(dateStr);
  const [plan, target, logs, mealLogs] = await Promise.all([
    activePlanOf(clientId),
    prisma.nutritionTarget.findFirst({ where: { clientId, isActive: true }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.dietLog.findMany({ where: { clientId, date } }),
    prisma.mealLog.findMany({ where: { clientId, date, status: 'COMPLETED' }, include: { items: true }, orderBy: { loggedAt: 'asc' } }),
  ]);
  const sumItems = (items: Array<Macros>) => items.reduce<Macros>((t, i) => addMacros(t, i), zero());
  const statusOf = new Map(logs.map((l) => [l.dietMealId, l.status]));
  const loggedByMeal = new Map(mealLogs.filter((m) => m.dietMealId).map((m) => [m.dietMealId!, m]));

  const meals: DailyMealDto[] = [];
  for (const m of plan?.meals ?? []) {
    const log = loggedByMeal.get(m.id);
    meals.push({
      key: `plan-${m.id}`, dietMealId: m.id, mealLogId: log?.id ?? null, mealType: m.mealType, name: m.name, timeOfDay: m.timeOfDay,
      status: (statusOf.get(m.id) as DailyMealDto['status']) ?? 'PENDING', planned: m.totals, consumed: log ? sumItems(log.items) : zero(), custom: false,
    });
  }
  for (const c of mealLogs.filter((m) => !m.dietMealId)) {
    meals.push({ key: `log-${c.id}`, dietMealId: null, mealLogId: c.id, mealType: c.mealType, name: c.items.map((i) => i.customName).filter(Boolean).slice(0, 2).join(', ') || 'Extra meal', timeOfDay: null, status: 'COMPLETED', planned: null, consumed: sumItems(c.items), custom: true });
  }
  return {
    date: dateStr, clientId, planName: plan?.name ?? null,
    target: target ? { calories: target.calories, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG, fiberG: target.fiberG, waterMl: target.waterMl } : null,
    consumed: sumItems(mealLogs.flatMap((m) => m.items)), meals,
  };
}

export { AppError, Prisma };
