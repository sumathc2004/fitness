import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { Exercise } from '@gym/database';
import type { ExerciseDto, ExerciseInput } from '@gym/types';
import { forbidden, notFound } from '../lib/errors';
import { audit } from './audit.service';

const arr = (v: Prisma.JsonValue | null): string[] => (Array.isArray(v) ? (v as string[]) : []);

export const toExerciseDto = (e: Exercise): ExerciseDto => ({
  id: e.id, slug: e.slug, name: e.name, description: e.description, category: e.category, difficulty: e.difficulty,
  equipment: arr(e.equipment), primaryMuscles: arr(e.primaryMuscles), secondaryMuscles: arr(e.secondaryMuscles), instructions: arr(e.instructions), commonMistakes: arr(e.commonMistakes),
  isActive: e.isActive, createdById: e.createdById,
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'exercise';

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await prisma.exercise.count({ where: { slug } }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function listExercises(q: { q?: string; category?: string; difficulty?: string; muscle?: string; includeInactive?: boolean }): Promise<ExerciseDto[]> {
  const rows = await prisma.exercise.findMany({
    where: {
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
      ...(q.category ? { category: q.category as Prisma.EnumExerciseCategoryFilter['equals'] } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty as Prisma.EnumExerciseDifficultyFilter['equals'] } : {}),
    },
    orderBy: { name: 'asc' },
  });
  let out = rows.map(toExerciseDto);
  if (q.muscle) { const m = q.muscle.toLowerCase(); out = out.filter((e) => [...e.primaryMuscles, ...e.secondaryMuscles].some((x) => x.toLowerCase() === m)); }
  return out;
}

export async function getExercise(id: string): Promise<ExerciseDto> {
  const e = await prisma.exercise.findUnique({ where: { id } });
  if (!e) throw notFound('Exercise not found');
  return toExerciseDto(e);
}

export async function createExercise(req: Request, input: ExerciseInput): Promise<ExerciseDto> {
  const e = await prisma.exercise.create({
    data: { ...input, slug: await uniqueSlug(input.name), createdById: req.auth!.trainerId ?? undefined },
  });
  await audit(req, { action: 'EXERCISE_CREATED', entityType: 'Exercise', entityId: e.id, after: { name: e.name } });
  return toExerciseDto(e);
}

async function assertCanEdit(req: Request, id: string) {
  const e = await prisma.exercise.findUnique({ where: { id }, select: { createdById: true } });
  if (!e) throw notFound('Exercise not found');
  // Admins edit anything; trainers may only edit exercises they created themselves.
  if (req.auth!.role === 'TRAINER' && e.createdById !== req.auth!.trainerId) throw forbidden('You can only edit exercises you created');
}

export async function updateExercise(req: Request, id: string, input: ExerciseInput): Promise<ExerciseDto> {
  await assertCanEdit(req, id);
  const e = await prisma.exercise.update({ where: { id }, data: input });
  await audit(req, { action: 'EXERCISE_UPDATED', entityType: 'Exercise', entityId: id });
  return toExerciseDto(e);
}

/** Soft delete: workouts that already use the exercise keep working. */
export async function archiveExercise(req: Request, id: string, active: boolean): Promise<void> {
  await assertCanEdit(req, id);
  await prisma.exercise.update({ where: { id }, data: { isActive: active } });
  await audit(req, { action: active ? 'EXERCISE_RESTORED' : 'EXERCISE_ARCHIVED', entityType: 'Exercise', entityId: id });
}
