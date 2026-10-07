import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { ExerciseDto, ExerciseInput } from '@gym/types';
import { AppError, forbidden, notFound } from '../lib/errors';
import { storage } from '../lib/storage';
import { audit } from './audit.service';

const include = { assets: { where: { isActive: true }, orderBy: { version: 'desc' } } } satisfies Prisma.ExerciseInclude;
type Row = Prisma.ExerciseGetPayload<{ include: typeof include }>;
const arr = (v: Prisma.JsonValue | null): string[] => (Array.isArray(v) ? (v as string[]) : []);

export const assetUrl = (key: string) => `/api/assets/${key}`;

export const toExerciseDto = (e: Row): ExerciseDto => ({
  id: e.id, slug: e.slug, name: e.name, description: e.description, category: e.category, difficulty: e.difficulty,
  equipment: arr(e.equipment), primaryMuscles: arr(e.primaryMuscles), secondaryMuscles: arr(e.secondaryMuscles), instructions: arr(e.instructions), commonMistakes: arr(e.commonMistakes),
  isActive: e.isActive, createdById: e.createdById,
  assets: e.assets.map((a) => ({ id: a.id, url: a.storageKey ? assetUrl(a.storageKey) : a.glbUrl, animationClip: a.animationClip, credit: a.credit, fileSizeBytes: a.fileSizeBytes, version: a.version, createdAt: a.createdAt.toISOString() })),
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

export async function listExercises(q: { q?: string; category?: string; difficulty?: string; muscle?: string; has3d?: boolean; includeInactive?: boolean }): Promise<ExerciseDto[]> {
  const rows = await prisma.exercise.findMany({
    where: {
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q ? { name: { contains: q.q } } : {}),
      ...(q.category ? { category: q.category as Prisma.EnumExerciseCategoryFilter['equals'] } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty as Prisma.EnumExerciseDifficultyFilter['equals'] } : {}),
    },
    include, orderBy: { name: 'asc' },
  });
  let out = rows.map(toExerciseDto);
  if (q.muscle) { const m = q.muscle.toLowerCase(); out = out.filter((e) => [...e.primaryMuscles, ...e.secondaryMuscles].some((x) => x.toLowerCase() === m)); }
  if (q.has3d) out = out.filter((e) => e.assets.length > 0);
  return out;
}

export async function getExercise(id: string): Promise<ExerciseDto> {
  const e = await prisma.exercise.findUnique({ where: { id }, include });
  if (!e) throw notFound('Exercise not found');
  return toExerciseDto(e);
}

export async function createExercise(req: Request, input: ExerciseInput): Promise<ExerciseDto> {
  const e = await prisma.exercise.create({
    data: { ...input, slug: await uniqueSlug(input.name), createdById: req.auth!.trainerId ?? undefined },
    include,
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
  const e = await prisma.exercise.update({ where: { id }, data: input, include });
  await audit(req, { action: 'EXERCISE_UPDATED', entityType: 'Exercise', entityId: id });
  return toExerciseDto(e);
}

/** Soft delete: workouts that already use the exercise keep working. */
export async function archiveExercise(req: Request, id: string, active: boolean): Promise<void> {
  await assertCanEdit(req, id);
  await prisma.exercise.update({ where: { id }, data: { isActive: active } });
  await audit(req, { action: active ? 'EXERCISE_RESTORED' : 'EXERCISE_ARCHIVED', entityType: 'Exercise', entityId: id });
}

// ───────────────────────── 3D assets
const GLB_MAGIC = 0x46546c67; // "glTF"

export async function addAsset(req: Request, exerciseId: string, file: { buffer: Buffer; originalname: string }, meta: { credit?: string; animationClip?: string }) {
  if (!(await prisma.exercise.count({ where: { id: exerciseId } }))) throw notFound('Exercise not found');
  if (file.buffer.length < 12 || file.buffer.readUInt32LE(0) !== GLB_MAGIC) throw new AppError(400, 'INVALID_FILE', 'That file is not a valid .glb (binary glTF) model');
  const saved = await storage.save('exercise3d', file.originalname, file.buffer);
  const last = await prisma.exercise3DAsset.findFirst({ where: { exerciseId }, orderBy: { version: 'desc' }, select: { version: true } });
  const asset = await prisma.exercise3DAsset.create({
    data: { exerciseId, glbUrl: assetUrl(saved.key), storageProvider: storage.name, storageKey: saved.key, fileSizeBytes: saved.size, version: (last?.version ?? 0) + 1, animationClip: meta.animationClip || null, credit: meta.credit || null },
  });
  await audit(req, { action: 'EXERCISE_3D_UPLOADED', entityType: 'Exercise', entityId: exerciseId, after: { assetId: asset.id, bytes: saved.size } });
  return getExercise(exerciseId);
}

export async function removeAsset(req: Request, exerciseId: string, assetId: string) {
  const a = await prisma.exercise3DAsset.findFirst({ where: { id: assetId, exerciseId } });
  if (!a) throw notFound('3D model not found');
  await prisma.exercise3DAsset.update({ where: { id: assetId }, data: { isActive: false } });
  if (a.storageKey) await storage.remove(a.storageKey).catch(() => undefined);
  await audit(req, { action: 'EXERCISE_3D_REMOVED', entityType: 'Exercise', entityId: exerciseId, after: { assetId } });
  return getExercise(exerciseId);
}
