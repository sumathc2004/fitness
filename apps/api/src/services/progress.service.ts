import type { Request } from 'express';
import { prisma } from '@gym/database';
import type { PhotoAngle } from '@gym/database';
import { estimate1RM } from '@gym/config';
import { daysAgo, isoDate, ratio, todayUTC } from '../lib/dates';
import { badRequest, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { storage } from '../lib/storage';
import { assertCanAccessClient } from './access.service';
import { audit, logActivity } from './audit.service';
import { notify } from './notification.service';

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface MeasurementInput {
  measuredAt?: string;
  weightKg?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  shoulderCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  notes?: string | null;
}

export async function addMeasurement(req: Request, clientId: string, input: MeasurementInput) {
  await assertCanAccessClient(req, clientId);
  const { measuredAt, ...rest } = input;
  const m = await prisma.bodyMeasurement.create({
    data: { clientId, ...rest, measuredAt: measuredAt ? new Date(measuredAt) : new Date(), recordedBy: req.auth!.userId },
  });
  if (input.weightKg != null) await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'WEIGHT_UPDATED', entityType: 'BodyMeasurement', entityId: m.id });
  return m;
}

export async function listMeasurements(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  return prisma.bodyMeasurement.findMany({ where: { clientId }, orderBy: { measuredAt: 'desc' }, take: 200 });
}

export async function deleteMeasurement(req: Request, id: string) {
  const m = await prisma.bodyMeasurement.findUnique({ where: { id }, select: { clientId: true } });
  if (!m) throw notFound('Measurement not found');
  await assertCanAccessClient(req, m.clientId);
  await prisma.bodyMeasurement.delete({ where: { id } });
}

/** Best estimated 1-rep-max per exercise over all of a client's completed sets, plus when it happened. */
export async function personalRecords(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  const sets = await prisma.workoutSet.findMany({
    where: { session: { clientId }, skipped: false, reps: { gt: 0 }, weightKg: { gt: 0 } },
    select: { reps: true, weightKg: true, completedAt: true, workoutExercise: { select: { exerciseId: true, customName: true, exercise: { select: { name: true } } } } },
  });
  const best = new Map<string, { exercise: string; weightKg: number; reps: number; oneRepMax: number; at: string | null }>();
  for (const s of sets) {
    const name = s.workoutExercise.exercise?.name ?? s.workoutExercise.customName ?? 'Exercise';
    const key = s.workoutExercise.exerciseId ?? name;
    const e1 = estimate1RM(s.weightKg!, s.reps!);
    const cur = best.get(key);
    if (!cur || e1 > cur.oneRepMax) best.set(key, { exercise: name, weightKg: s.weightKg!, reps: s.reps!, oneRepMax: r1(e1), at: s.completedAt?.toISOString() ?? null });
  }
  return [...best.values()].sort((a, b) => b.oneRepMax - a.oneRepMax);
}

export async function progressSummary(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  const since = daysAgo(90);
  const [measurements, assessments, prs, workouts, dietLogs, sessions] = await Promise.all([
    prisma.bodyMeasurement.findMany({ where: { clientId }, orderBy: { measuredAt: 'asc' }, take: 300 }),
    prisma.bodyCompositionAssessment.findMany({ where: { clientId }, orderBy: { assessedAt: 'asc' }, take: 100 }),
    personalRecords(req, clientId),
    prisma.workout.findMany({ where: { clientId, isTemplate: false, status: { not: 'DRAFT' }, scheduledDate: { gte: since, lte: todayUTC() } }, select: { status: true } }),
    prisma.dietLog.findMany({ where: { clientId, date: { gte: since, lte: todayUTC() } }, select: { status: true } }),
    prisma.workoutSession.count({ where: { clientId, status: 'COMPLETED', startedAt: { gte: since } } }),
  ]);
  const weights = measurements.filter((m) => m.weightKg != null);
  const first = weights[0];
  const last = weights[weights.length - 1];
  const bf = assessments.filter((a) => a.bodyFatPct != null);
  return {
    weight: { series: weights.map((m) => ({ date: isoDate(m.measuredAt), value: m.weightKg! })), changeKg: first && last && first !== last ? r1(last.weightKg! - first.weightKg!) : null },
    waist: measurements.filter((m) => m.waistCm != null).map((m) => ({ date: isoDate(m.measuredAt), value: m.waistCm! })),
    chest: measurements.filter((m) => m.chestCm != null).map((m) => ({ date: isoDate(m.measuredAt), value: m.chestCm! })),
    arm: measurements.filter((m) => m.armCm != null).map((m) => ({ date: isoDate(m.measuredAt), value: m.armCm! })),
    bodyFat: { isEstimate: true, series: bf.map((a) => ({ date: isoDate(a.assessedAt), value: a.bodyFatPct! })), changePct: bf.length > 1 ? r1(bf[bf.length - 1]!.bodyFatPct! - bf[0]!.bodyFatPct!) : null },
    leanMass: assessments.filter((a) => a.leanMassKg != null).map((a) => ({ date: isoDate(a.assessedAt), value: a.leanMassKg! })),
    records: prs.slice(0, 10),
    compliance: {
      workout: ratio(workouts.filter((w) => w.status === 'COMPLETED').length, workouts.length),
      diet: ratio(dietLogs.filter((d) => d.status === 'COMPLETED').length, dietLogs.length),
      sessions90d: sessions,
    },
  };
}

// ───────────────────────── Photos
export async function addPhoto(req: Request, clientId: string, file: { buffer: Buffer; mimetype: string; originalname: string }, meta: { angle: PhotoAngle; weightKg?: number | null; notes?: string | null; takenAt?: string }) {
  await assertCanAccessClient(req, clientId);
  const kind = detectImage(file.buffer);
  if (!kind) throw badRequest('Upload a JPG, PNG or WebP image');
  const saved = await storage.save(`progress/${clientId}`, `photo.${kind}`, file.buffer);
  const photo = await prisma.progressPhoto.create({
    data: { clientId, angle: meta.angle, url: '', storageKey: saved.key, weightKg: meta.weightKg ?? null, notes: meta.notes ?? null, takenAt: meta.takenAt ? new Date(meta.takenAt) : new Date() },
  });
  const updated = await prisma.progressPhoto.update({ where: { id: photo.id }, data: { url: `/api/progress/photos/${photo.id}/file` } });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'PROGRESS_PHOTO_ADDED', entityType: 'ProgressPhoto', entityId: photo.id });
  return photoDto(updated);
}

function detectImage(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

const photoDto = (p: { id: string; takenAt: Date; angle: PhotoAngle; url: string; weightKg: number | null; notes: string | null }) => ({
  id: p.id, takenAt: p.takenAt.toISOString(), angle: p.angle, url: p.url, weightKg: p.weightKg, notes: p.notes,
});

export async function listPhotos(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  const rows = await prisma.progressPhoto.findMany({ where: { clientId }, orderBy: { takenAt: 'desc' }, take: 200 });
  return rows.map(photoDto);
}

/** Photos are private: only the owner, their trainer or an admin can stream them. */
export async function photoFile(req: Request, id: string) {
  const p = await prisma.progressPhoto.findUnique({ where: { id }, select: { clientId: true, storageKey: true } });
  if (!p?.storageKey) throw notFound('Photo not found');
  await assertCanAccessClient(req, p.clientId);
  return storage.pathFor!(p.storageKey);
}

export async function deletePhoto(req: Request, id: string) {
  const p = await prisma.progressPhoto.findUnique({ where: { id }, select: { clientId: true, storageKey: true } });
  if (!p) throw notFound('Photo not found');
  await assertCanAccessClient(req, p.clientId);
  await prisma.progressPhoto.delete({ where: { id } });
  if (p.storageKey) await storage.remove(p.storageKey);
}

// ───────────────────────── Trainer review of weekly / monthly progress
export async function periodReview(req: Request, clientId: string, period: 'WEEKLY' | 'MONTHLY', start: string) {
  await assertCanAccessClient(req, clientId);
  return prisma.progressRecord.findUnique({ where: { clientId_period_periodStart: { clientId, period, periodStart: dateOnly(start) } } });
}

export async function saveReview(req: Request, clientId: string, input: { period: 'WEEKLY' | 'MONTHLY'; periodStart: string; periodEnd: string; trainerComment: string }) {
  await assertCanAccessClient(req, clientId);
  const periodStart = dateOnly(input.periodStart);
  const rec = await prisma.progressRecord.upsert({
    where: { clientId_period_periodStart: { clientId, period: input.period, periodStart } },
    update: { trainerComment: input.trainerComment, reviewedById: req.auth!.userId, reviewedAt: new Date() },
    create: { clientId, period: input.period, periodStart, periodEnd: dateOnly(input.periodEnd), trainerComment: input.trainerComment, reviewedById: req.auth!.userId, reviewedAt: new Date() },
  });
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { userId: true } });
  if (c) await notify({ userId: c.userId, type: 'PROGRESS_REVIEW', title: `Your ${input.period.toLowerCase()} progress was reviewed`, body: input.trainerComment.slice(0, 200) });
  await audit(req, { action: 'PROGRESS_REVIEWED', entityType: 'ProgressRecord', entityId: rec.id });
  return rec;
}

export async function activityFeed(req: Request, clientId: string, take = 40) {
  await assertCanAccessClient(req, clientId);
  const rows = await prisma.activityLog.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take });
  return rows.map((r) => ({ id: r.id, type: r.type, at: r.createdAt.toISOString(), entityType: r.entityType, entityId: r.entityId }));
}
