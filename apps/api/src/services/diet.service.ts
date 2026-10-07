import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { DietDto, DietInput, DietMealDto, DietSummary, Macros } from '@gym/types';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { assertCanAccessClient } from './access.service';
import { audit } from './audit.service';
import { clientUserIdOf, notify } from './notification.service';

const dietInclude = {
  meals: { orderBy: { order: 'asc' as const }, include: { items: { include: { food: { select: { name: true } }, serving: { select: { label: true } } } } } },
  client: { select: { user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.DietPlanInclude;
type PlanRow = Prisma.DietPlanGetPayload<{ include: typeof dietInclude }>;

const r1 = (n: number) => Math.round(n * 10) / 10;
export const zero = (): Macros => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
export const addMacros = (a: Macros, b: Macros): Macros => ({ calories: Math.round(a.calories + b.calories), proteinG: r1(a.proteinG + b.proteinG), carbsG: r1(a.carbsG + b.carbsG), fatG: r1(a.fatG + b.fatG), fiberG: r1(a.fiberG + b.fiberG) });
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toDietDto(p: PlanRow): DietDto {
  const meals: DietMealDto[] = p.meals.map((m) => {
    const items = m.items.map((i) => ({
      id: i.id, name: i.food?.name ?? i.customName ?? 'Custom food', quantity: i.quantity, servingLabel: i.serving?.label ?? null, foodItemId: i.foodItemId, foodServingId: i.foodServingId,
      calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG,
    }));
    return { id: m.id, mealType: m.mealType, name: m.name, timeOfDay: m.timeOfDay, order: m.order, notes: m.notes, items, totals: items.reduce<Macros>((t, i) => addMacros(t, i), zero()) };
  });
  return {
    id: p.id, name: p.name, clientId: p.clientId, clientName: p.client ? `${p.client.user.firstName} ${p.client.user.lastName}` : null, isTemplate: p.isTemplate, status: p.status,
    startDate: day(p.startDate), notes: p.notes, targetId: p.targetId, meals, totals: meals.reduce<Macros>((t, m) => addMacros(t, m.totals), zero()), createdAt: p.createdAt.toISOString(),
  };
}

function visibility(req: Request): Prisma.DietPlanWhereInput {
  const a = req.auth!;
  if (a.role === 'SUPER_ADMIN') return {};
  if (a.role === 'CLIENT') return { isTemplate: false, clientId: a.clientId ?? '__none__', status: { not: 'DRAFT' } };
  return {
    OR: [
      { isTemplate: true, OR: [{ trainerId: a.trainerId }, { trainerId: null }] },
      { isTemplate: false, client: { trainers: { some: { trainerId: a.trainerId ?? '__none__', endedAt: null } } } },
    ],
  };
}

/** Macros come from the food database (serving × quantity) so a trainer can't mistype them; custom foods carry their own. */
async function resolveItems(items: DietInput['meals'][number]['items']) {
  const ids = [...new Set(items.map((i) => i.foodServingId).filter((x): x is string => !!x))];
  const servings = ids.length ? await prisma.foodServing.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(servings.map((s) => [s.id, s]));
  return items.map((i) => {
    if (i.foodServingId) {
      const s = byId.get(i.foodServingId);
      if (!s) throw badRequest('One of the selected foods no longer exists');
      const q = i.quantity;
      return { foodItemId: s.foodItemId, foodServingId: s.id, customName: null as string | null, quantity: q, calories: Math.round(s.calories * q), proteinG: r1(s.proteinG * q), carbsG: r1(s.carbsG * q), fatG: r1(s.fatG * q), fiberG: r1(s.fiberG * q) };
    }
    return { foodItemId: null, foodServingId: null, customName: i.customName ?? 'Custom food', quantity: i.quantity, calories: Math.round(i.calories ?? 0), proteinG: i.proteinG ?? 0, carbsG: i.carbsG ?? 0, fatG: i.fatG ?? 0, fiberG: i.fiberG ?? 0 };
  });
}

export async function listDiets(req: Request, q: { clientId?: string; template?: boolean }): Promise<DietSummary[]> {
  if (q.clientId) await assertCanAccessClient(req, q.clientId);
  const rows = await prisma.dietPlan.findMany({
    where: { AND: [visibility(req), { ...(q.clientId ? { clientId: q.clientId } : {}), ...(q.template !== undefined ? { isTemplate: q.template } : {}) }] },
    include: dietInclude, orderBy: { createdAt: 'desc' }, take: 300,
  });
  return rows.map((p) => {
    const d = toDietDto(p);
    return { id: d.id, name: d.name, clientId: d.clientId, clientName: d.clientName, isTemplate: d.isTemplate, status: d.status, mealCount: d.meals.length, calories: d.totals.calories, startDate: d.startDate };
  });
}

export async function getDiet(req: Request, id: string): Promise<DietDto> {
  const p = await prisma.dietPlan.findFirst({ where: { id, ...visibility(req) }, include: dietInclude });
  if (!p) throw notFound('Diet plan not found');
  return toDietDto(p);
}

async function mealCreates(meals: DietInput['meals']) {
  return Promise.all(meals.map(async (m, order) => ({ mealType: m.mealType, name: m.name, order, timeOfDay: m.timeOfDay ?? null, notes: m.notes ?? null, items: { create: await resolveItems(m.items) } })));
}

async function archiveOtherActive(tx: Prisma.TransactionClient, clientId: string, exceptId: string) {
  await tx.dietPlan.updateMany({ where: { clientId, isTemplate: false, status: 'ACTIVE', id: { not: exceptId } }, data: { status: 'ARCHIVED' } });
}

async function announce(clientId: string, name: string) {
  const uid = await clientUserIdOf(clientId);
  if (uid) await notify({ userId: uid, type: 'DIET_ASSIGNED', title: 'New diet plan', body: name, data: { clientId } });
}

export async function createDiet(req: Request, input: DietInput): Promise<DietDto> {
  const a = req.auth!;
  if (a.role === 'CLIENT') throw forbidden();
  if (input.isTemplate && input.clientId) throw badRequest('A template cannot belong to a client');
  if (!input.isTemplate) {
    if (!input.clientId) throw badRequest('Choose a client for this plan', { clientId: ['Required'] });
    await assertCanAccessClient(req, input.clientId);
  }
  const active = !input.isTemplate && !!input.startDate;
  const target = !input.isTemplate && input.clientId ? await prisma.nutritionTarget.findFirst({ where: { clientId: input.clientId, isActive: true }, select: { id: true } }) : null;
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.dietPlan.create({
      data: {
        name: input.name, trainerId: a.trainerId, createdById: a.userId, clientId: input.isTemplate ? null : input.clientId, isTemplate: input.isTemplate, targetId: input.targetId ?? target?.id ?? null,
        status: active ? 'ACTIVE' : 'DRAFT', startDate: input.startDate ? dateOnly(input.startDate) : null, notes: input.notes, meals: { create: await mealCreates(input.meals) },
      },
      include: dietInclude,
    });
    if (active && p.clientId) await archiveOtherActive(tx, p.clientId, p.id);
    return p;
  });
  await audit(req, { action: input.isTemplate ? 'DIET_TEMPLATE_CREATED' : 'DIET_CREATED', entityType: 'DietPlan', entityId: created.id });
  if (active && created.clientId) await announce(created.clientId, created.name);
  return toDietDto(created);
}

async function assertCanEdit(req: Request, id: string) {
  const p = await prisma.dietPlan.findFirst({ where: { id, ...visibility(req) }, select: { id: true, trainerId: true, isTemplate: true, clientId: true, status: true } });
  if (!p) throw notFound('Diet plan not found');
  if (req.auth!.role === 'CLIENT') throw forbidden();
  if (req.auth!.role === 'TRAINER' && p.isTemplate && p.trainerId !== req.auth!.trainerId) throw forbidden('Shared templates can only be edited by an administrator — duplicate it instead');
  return p;
}

/** Edits in place and keeps existing meals (matched by id) so the client's logged history survives. */
export async function updateDiet(req: Request, id: string, input: DietInput): Promise<DietDto> {
  const p = await assertCanEdit(req, id);
  const keepIds = input.meals.map((m) => m.id).filter((x): x is string => !!x);
  const owned = keepIds.length ? await prisma.dietMeal.count({ where: { id: { in: keepIds }, dietPlanId: id } }) : 0;
  if (owned !== keepIds.length) throw badRequest('A meal does not belong to this plan');
  const resolved = await Promise.all(input.meals.map(async (m) => ({ m, items: await resolveItems(m.items) })));
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dietMeal.deleteMany({ where: { dietPlanId: id, id: { notIn: keepIds } } });
    for (const [order, { m, items }] of resolved.entries()) {
      const data = { mealType: m.mealType, name: m.name, order, timeOfDay: m.timeOfDay ?? null, notes: m.notes ?? null };
      if (m.id) {
        await tx.dietMealItem.deleteMany({ where: { dietMealId: m.id } });
        await tx.dietMeal.update({ where: { id: m.id }, data: { ...data, items: { create: items } } });
      } else {
        await tx.dietMeal.create({ data: { ...data, dietPlanId: id, items: { create: items } } });
      }
    }
    return tx.dietPlan.update({ where: { id }, data: { name: input.name, notes: input.notes ?? null, startDate: input.startDate ? dateOnly(input.startDate) : undefined }, include: dietInclude });
  });
  void p;
  await audit(req, { action: 'DIET_UPDATED', entityType: 'DietPlan', entityId: id });
  return toDietDto(updated);
}

export async function activateDiet(req: Request, id: string): Promise<DietDto> {
  const p = await assertCanEdit(req, id);
  if (p.isTemplate || !p.clientId) throw badRequest('Only a client plan can be activated');
  const updated = await prisma.$transaction(async (tx) => {
    await archiveOtherActive(tx, p.clientId!, id);
    return tx.dietPlan.update({ where: { id }, data: { status: 'ACTIVE', startDate: new Date() }, include: dietInclude });
  });
  await announce(p.clientId, updated.name);
  await audit(req, { action: 'DIET_ACTIVATED', entityType: 'DietPlan', entityId: id });
  return toDietDto(updated);
}

export async function deleteDiet(req: Request, id: string): Promise<{ archived: boolean }> {
  await assertCanEdit(req, id);
  const logs = await prisma.dietLog.count({ where: { meal: { dietPlanId: id } } });
  if (logs > 0) {
    await prisma.dietPlan.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await audit(req, { action: 'DIET_ARCHIVED', entityType: 'DietPlan', entityId: id });
    return { archived: true };
  }
  await prisma.dietPlan.delete({ where: { id } });
  await audit(req, { action: 'DIET_DELETED', entityType: 'DietPlan', entityId: id });
  return { archived: false };
}

export async function assignDiet(req: Request, id: string, clientIds: string[], startDate: string): Promise<DietSummary[]> {
  if (req.auth!.role === 'CLIENT') throw forbidden();
  const src = await prisma.dietPlan.findFirst({ where: { id, ...visibility(req) }, include: dietInclude });
  if (!src) throw notFound('Diet plan not found');
  for (const c of clientIds) await assertCanAccessClient(req, c);
  const out: DietSummary[] = [];
  for (const clientId of clientIds) {
    const target = await prisma.nutritionTarget.findFirst({ where: { clientId, isActive: true }, select: { id: true } });
    const copy = await prisma.$transaction(async (tx) => {
      const c = await tx.dietPlan.create({
        data: {
          name: src.name.replace(/ \(copy\)$/, ''), trainerId: req.auth!.trainerId, createdById: req.auth!.userId, clientId, isTemplate: false, status: 'ACTIVE', startDate: dateOnly(startDate), notes: src.notes, targetId: target?.id ?? null,
          meals: { create: src.meals.map((m) => ({ mealType: m.mealType, name: m.name, order: m.order, timeOfDay: m.timeOfDay, notes: m.notes, items: { create: m.items.map((i) => ({ foodItemId: i.foodItemId, foodServingId: i.foodServingId, customName: i.customName, quantity: i.quantity, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG })) } })) },
        },
        include: dietInclude,
      });
      await archiveOtherActive(tx, clientId, c.id);
      return c;
    });
    await announce(clientId, copy.name);
    const d = toDietDto(copy);
    out.push({ id: d.id, name: d.name, clientId, clientName: d.clientName, isTemplate: false, status: d.status, mealCount: d.meals.length, calories: d.totals.calories, startDate });
  }
  await audit(req, { action: 'DIET_ASSIGNED', entityType: 'DietPlan', entityId: id, after: { clientIds, startDate } });
  return out;
}

export async function activePlanOf(clientId: string): Promise<DietDto | null> {
  const p = await prisma.dietPlan.findFirst({ where: { clientId, isTemplate: false, status: 'ACTIVE' }, include: dietInclude, orderBy: { startDate: 'desc' } });
  return p ? toDietDto(p) : null;
}

export { AppError };
