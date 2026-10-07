import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { FoodDto, FoodInput } from '@gym/types';
import { forbidden, notFound } from '../lib/errors';
import { audit } from './audit.service';

const include = { servings: { orderBy: [{ isDefault: 'desc' as const }, { calories: 'asc' as const }] } } satisfies Prisma.FoodItemInclude;
type Row = Prisma.FoodItemGetPayload<{ include: typeof include }>;

const toDto = (f: Row): FoodDto => ({
  id: f.id, name: f.name, category: f.category, cuisine: f.cuisine, brand: f.brand, isCustom: f.isCustom,
  servings: f.servings.map((s) => ({ id: s.id, label: s.label, grams: s.grams, calories: s.calories, proteinG: s.proteinG, carbsG: s.carbsG, fatG: s.fatG, fiberG: s.fiberG, isDefault: s.isDefault })),
});

export async function listFoods(q: { q?: string; category?: string; limit: number }): Promise<{ items: FoodDto[]; categories: string[] }> {
  const [rows, cats] = await Promise.all([
    prisma.foodItem.findMany({
      where: { isActive: true, ...(q.q ? { name: { contains: q.q } } : {}), ...(q.category ? { category: q.category } : {}) },
      include, orderBy: { name: 'asc' }, take: q.limit,
    }),
    prisma.foodItem.findMany({ where: { isActive: true, category: { not: null } }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ]);
  return { items: rows.map(toDto), categories: cats.map((c) => c.category!).filter(Boolean) };
}

export async function getFood(id: string): Promise<FoodDto> {
  const f = await prisma.foodItem.findFirst({ where: { id, isActive: true }, include });
  if (!f) throw notFound('Food not found');
  return toDto(f);
}

const servingRows = (i: FoodInput) => {
  const hasDefault = i.servings.some((s) => s.isDefault);
  return i.servings.map((s, idx) => ({ label: s.label, grams: s.grams ?? null, calories: s.calories, proteinG: s.proteinG, carbsG: s.carbsG, fatG: s.fatG, fiberG: s.fiberG, isDefault: hasDefault ? s.isDefault : idx === 0 }));
};

export async function createFood(req: Request, input: FoodInput): Promise<FoodDto> {
  const f = await prisma.foodItem.create({
    data: { name: input.name, category: input.category, cuisine: input.cuisine, brand: input.brand, isCustom: true, createdById: req.auth!.userId, servings: { create: servingRows(input) } },
    include,
  });
  await audit(req, { action: 'FOOD_CREATED', entityType: 'FoodItem', entityId: f.id });
  return toDto(f);
}

async function assertCanEdit(req: Request, id: string) {
  const f = await prisma.foodItem.findUnique({ where: { id }, select: { isCustom: true, createdById: true } });
  if (!f) throw notFound('Food not found');
  // Admins edit any food. Trainers may edit only the foods they added.
  if (req.auth!.role !== 'SUPER_ADMIN' && f.createdById !== req.auth!.userId) throw forbidden('You can only edit foods you added');
}

export async function updateFood(req: Request, id: string, input: FoodInput): Promise<FoodDto> {
  await assertCanEdit(req, id);
  const f = await prisma.$transaction(async (tx) => {
    // Plans and logs keep their own copied macros, so replacing servings is safe; links just become null.
    await tx.foodServing.deleteMany({ where: { foodItemId: id } });
    return tx.foodItem.update({
      where: { id },
      data: { name: input.name, category: input.category, cuisine: input.cuisine, brand: input.brand, servings: { create: servingRows(input) } },
      include,
    });
  });
  await audit(req, { action: 'FOOD_UPDATED', entityType: 'FoodItem', entityId: id });
  return toDto(f);
}

export async function removeFood(req: Request, id: string): Promise<void> {
  await assertCanEdit(req, id);
  await prisma.foodItem.update({ where: { id }, data: { isActive: false } });
  await audit(req, { action: 'FOOD_REMOVED', entityType: 'FoodItem', entityId: id });
}
