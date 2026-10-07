import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { PreviousPerformance, SessionDto, SessionSummary, SetLogInput, WorkoutDto, WorkoutExerciseDto, WorkoutInput, WorkoutSummary } from '@gym/types';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { todayUTC } from '../lib/dates';
import { assertCanAccessClient } from './access.service';
import { audit, logActivity } from './audit.service';
import { clientUserIdOf, notify } from './notification.service';

const wxInclude = {
  exercise: { select: { id: true, slug: true, name: true, primaryMuscles: true, assets: { where: { isActive: true }, select: { id: true }, take: 1 } } },
} satisfies Prisma.WorkoutExerciseInclude;
const workoutInclude = {
  exercises: { orderBy: { order: 'asc' as const }, include: wxInclude },
  client: { select: { user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.WorkoutInclude;
type WorkoutRow = Prisma.WorkoutGetPayload<{ include: typeof workoutInclude }>;
type WxRow = WorkoutRow['exercises'][number];

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const clientName = (w: { client: { user: { firstName: string; lastName: string } } | null }) => (w.client ? `${w.client.user.firstName} ${w.client.user.lastName}` : null);

const toWx = (e: WxRow): WorkoutExerciseDto => ({
  id: e.id, exerciseId: e.exerciseId, name: e.exercise?.name ?? e.customName ?? 'Exercise', slug: e.exercise?.slug ?? null, section: e.section, order: e.order, sets: e.sets, reps: e.reps,
  weightKg: e.weightKg, restSec: e.restSec, tempo: e.tempo, technique: e.technique, supersetGroup: e.supersetGroup, notes: e.notes,
  primaryMuscles: Array.isArray(e.exercise?.primaryMuscles) ? (e.exercise!.primaryMuscles as string[]) : [], hasAsset: (e.exercise?.assets.length ?? 0) > 0,
});

export const toWorkoutDto = (w: WorkoutRow): WorkoutDto => ({
  id: w.id, name: w.name, clientId: w.clientId, clientName: clientName(w), trainerId: w.trainerId ?? '', isTemplate: w.isTemplate, scheduledDate: day(w.scheduledDate),
  status: w.status, estimatedMin: w.estimatedMin, notes: w.notes, exercises: w.exercises.map(toWx), createdAt: w.createdAt.toISOString(),
});

/** What the caller is allowed to see. */
function visibility(req: Request): Prisma.WorkoutWhereInput {
  const a = req.auth!;
  if (a.role === 'SUPER_ADMIN') return {};
  if (a.role === 'CLIENT') return { isTemplate: false, clientId: a.clientId ?? '__none__', status: { not: 'DRAFT' } };
  return {
    OR: [
      { isTemplate: true, OR: [{ trainerId: a.trainerId }, { trainerId: null }] }, // own templates + shared (admin) templates
      { isTemplate: false, client: { trainers: { some: { trainerId: a.trainerId ?? '__none__', endedAt: null } } } },
    ],
  };
}

async function assertCanEditWorkout(req: Request, id: string) {
  const w = await prisma.workout.findFirst({ where: { id, ...visibility(req) }, select: { id: true, trainerId: true, isTemplate: true, clientId: true } });
  if (!w) throw notFound('Workout not found');
  const a = req.auth!;
  if (a.role === 'CLIENT') throw forbidden();
  if (a.role === 'TRAINER' && w.isTemplate && w.trainerId !== a.trainerId) throw forbidden('Shared templates can only be edited by an administrator — duplicate it to make your own copy');
  return w;
}

const exerciseRows = (exercises: WorkoutInput['exercises']) =>
  exercises.map((e, order) => ({
    exerciseId: e.exerciseId ?? null, customName: e.exerciseId ? null : e.customName ?? null, section: e.section, order, sets: e.sets, reps: e.reps, weightKg: e.weightKg ?? null,
    restSec: e.restSec, tempo: e.tempo ?? null, technique: e.technique, supersetGroup: e.technique === 'SUPERSET' ? e.supersetGroup ?? null : null, notes: e.notes ?? null,
  }));

async function assertExercisesExist(exercises: WorkoutInput['exercises']) {
  const ids = [...new Set(exercises.map((e) => e.exerciseId).filter((x): x is string => !!x))];
  if (ids.length && (await prisma.exercise.count({ where: { id: { in: ids } } })) !== ids.length) throw badRequest('One of the selected exercises no longer exists');
}

// ───────────────────────────────────────────────────────── CRUD
export async function listWorkouts(req: Request, q: { clientId?: string; template?: boolean; from?: string; to?: string; status?: string }): Promise<WorkoutSummary[]> {
  if (q.clientId) await assertCanAccessClient(req, q.clientId);
  const rows = await prisma.workout.findMany({
    where: {
      AND: [visibility(req), {
        ...(q.clientId ? { clientId: q.clientId } : {}),
        ...(q.template !== undefined ? { isTemplate: q.template } : {}),
        ...(q.from || q.to ? { scheduledDate: { ...(q.from ? { gte: dateOnly(q.from) } : {}), ...(q.to ? { lte: dateOnly(q.to) } : {}) } } : {}),
        ...(q.status ? { status: q.status as Prisma.EnumWorkoutStatusFilter['equals'] } : {}),
      }],
    },
    orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }], take: 500,
    include: { client: { select: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { exercises: true } } },
  });
  return rows.map((w) => ({ id: w.id, name: w.name, clientId: w.clientId, clientName: clientName(w), isTemplate: w.isTemplate, scheduledDate: day(w.scheduledDate), status: w.status, exerciseCount: w._count.exercises, estimatedMin: w.estimatedMin }));
}

export async function getWorkout(req: Request, id: string): Promise<WorkoutDto> {
  const w = await prisma.workout.findFirst({ where: { id, ...visibility(req) }, include: workoutInclude });
  if (!w) throw notFound('Workout not found');
  return toWorkoutDto(w);
}

export async function todaysWorkouts(req: Request): Promise<WorkoutDto[]> {
  const clientId = req.auth!.clientId;
  if (!clientId) throw forbidden();
  const rows = await prisma.workout.findMany({ where: { clientId, isTemplate: false, scheduledDate: todayUTC(), status: { not: 'DRAFT' } }, include: workoutInclude, orderBy: { createdAt: 'asc' } });
  return rows.map(toWorkoutDto);
}

export async function createWorkout(req: Request, input: WorkoutInput): Promise<WorkoutDto> {
  const a = req.auth!;
  if (a.role === 'CLIENT') throw forbidden();
  if (input.isTemplate && input.clientId) throw badRequest('A template cannot belong to a client');
  if (!input.isTemplate) {
    if (!input.clientId) throw badRequest('Choose a client for this workout', { clientId: ['Required'] });
    await assertCanAccessClient(req, input.clientId);
  }
  await assertExercisesExist(input.exercises);
  const status = input.isTemplate ? 'DRAFT' : input.scheduledDate ? 'ASSIGNED' : 'DRAFT';
  const w = await prisma.workout.create({
    data: {
      name: input.name, trainerId: a.trainerId, createdById: a.userId, clientId: input.isTemplate ? null : input.clientId, isTemplate: input.isTemplate,
      scheduledDate: input.scheduledDate ? dateOnly(input.scheduledDate) : null, estimatedMin: input.estimatedMin, notes: input.notes, status,
      exercises: { create: exerciseRows(input.exercises) },
    },
    include: workoutInclude,
  });
  await audit(req, { action: input.isTemplate ? 'WORKOUT_TEMPLATE_CREATED' : 'WORKOUT_CREATED', entityType: 'Workout', entityId: w.id });
  if (status === 'ASSIGNED' && w.clientId) await notifyAssigned(w.clientId, w.name, input.scheduledDate!);
  return toWorkoutDto(w);
}

async function notifyAssigned(clientId: string, name: string, date: string) {
  const uid = await clientUserIdOf(clientId);
  if (uid) await notify({ userId: uid, type: 'WORKOUT_ASSIGNED', title: 'New workout assigned', body: `${name} — ${date}`, data: { clientId, date } });
}

export async function updateWorkout(req: Request, id: string, input: WorkoutInput): Promise<WorkoutDto> {
  const w = await assertCanEditWorkout(req, id);
  if ((await prisma.workoutSession.count({ where: { workoutId: id } })) > 0) throw new AppError(409, 'WORKOUT_HAS_LOGS', 'This workout already has logged sessions. Duplicate it to make changes.');
  await assertExercisesExist(input.exercises);
  const wasAssigned = await prisma.workout.findUnique({ where: { id }, select: { status: true, scheduledDate: true } });
  const status = w.isTemplate ? 'DRAFT' : input.scheduledDate ? 'ASSIGNED' : 'DRAFT';
  const updated = await prisma.$transaction(async (tx) => {
    await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
    return tx.workout.update({
      where: { id },
      data: { name: input.name, scheduledDate: input.scheduledDate ? dateOnly(input.scheduledDate) : null, estimatedMin: input.estimatedMin ?? null, notes: input.notes ?? null, status, exercises: { create: exerciseRows(input.exercises) } },
      include: workoutInclude,
    });
  });
  await audit(req, { action: 'WORKOUT_UPDATED', entityType: 'Workout', entityId: id });
  const newlyScheduled = status === 'ASSIGNED' && (wasAssigned?.status !== 'ASSIGNED' || day(wasAssigned?.scheduledDate ?? null) !== input.scheduledDate);
  if (newlyScheduled && updated.clientId) await notifyAssigned(updated.clientId, updated.name, input.scheduledDate!);
  return toWorkoutDto(updated);
}

export async function deleteWorkout(req: Request, id: string): Promise<void> {
  await assertCanEditWorkout(req, id);
  if ((await prisma.workoutSession.count({ where: { workoutId: id } })) > 0) throw new AppError(409, 'WORKOUT_HAS_LOGS', 'This workout has logged sessions and cannot be deleted.');
  await prisma.workout.delete({ where: { id } });
  await audit(req, { action: 'WORKOUT_DELETED', entityType: 'Workout', entityId: id });
}

export async function duplicateWorkout(req: Request, id: string): Promise<WorkoutDto> {
  const src = await prisma.workout.findFirst({ where: { id, ...visibility(req) }, include: { exercises: { orderBy: { order: 'asc' } } } });
  if (!src) throw notFound('Workout not found');
  if (req.auth!.role === 'CLIENT') throw forbidden();
  const copy = await prisma.workout.create({
    data: {
      name: `${src.name} (copy)`, trainerId: req.auth!.trainerId, createdById: req.auth!.userId, clientId: src.clientId, isTemplate: src.isTemplate, status: 'DRAFT', estimatedMin: src.estimatedMin, notes: src.notes,
      exercises: { create: src.exercises.map((e) => ({ exerciseId: e.exerciseId, customName: e.customName, section: e.section, order: e.order, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSec: e.restSec, tempo: e.tempo, technique: e.technique, supersetGroup: e.supersetGroup, notes: e.notes })) },
    },
    include: workoutInclude,
  });
  return toWorkoutDto(copy);
}

/** Copy a workout/template to one or more clients on a date. */
export async function assignWorkout(req: Request, id: string, clientIds: string[], date: string): Promise<WorkoutSummary[]> {
  if (req.auth!.role === 'CLIENT') throw forbidden();
  const src = await prisma.workout.findFirst({ where: { id, ...visibility(req) }, include: { exercises: { orderBy: { order: 'asc' } } } });
  if (!src) throw notFound('Workout not found');
  for (const c of clientIds) await assertCanAccessClient(req, c);
  const created: WorkoutSummary[] = [];
  for (const clientId of clientIds) {
    const w = await prisma.workout.create({
      data: {
        name: src.name.replace(/ \(copy\)$/, ''), trainerId: req.auth!.trainerId, createdById: req.auth!.userId, clientId, isTemplate: false, scheduledDate: dateOnly(date), status: 'ASSIGNED', estimatedMin: src.estimatedMin, notes: src.notes,
        exercises: { create: src.exercises.map((e) => ({ exerciseId: e.exerciseId, customName: e.customName, section: e.section, order: e.order, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSec: e.restSec, tempo: e.tempo, technique: e.technique, supersetGroup: e.supersetGroup, notes: e.notes })) },
      },
      include: { client: { select: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { exercises: true } } },
    });
    await notifyAssigned(clientId, w.name, date);
    created.push({ id: w.id, name: w.name, clientId, clientName: clientName(w), isTemplate: false, scheduledDate: date, status: 'ASSIGNED', exerciseCount: w._count.exercises, estimatedMin: w.estimatedMin });
  }
  await audit(req, { action: 'WORKOUT_ASSIGNED', entityType: 'Workout', entityId: id, after: { clientIds, date } });
  return created;
}

// ───────────────────────────────────────────────────────── sessions (the client performing a workout)
const sessionInclude = { workout: { include: workoutInclude }, sets: true } satisfies Prisma.WorkoutSessionInclude;
type SessionRow = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionInclude }>;

async function previousFor(clientId: string, sessionId: string, wxs: WxRow[]): Promise<PreviousPerformance[]> {
  const ids = [...new Set(wxs.map((w) => w.exerciseId).filter((x): x is string => !!x))];
  if (!ids.length) return [];
  const sets = await prisma.workoutSet.findMany({
    where: { skipped: false, completedAt: { not: null }, session: { clientId, id: { not: sessionId }, status: 'COMPLETED' }, workoutExercise: { exerciseId: { in: ids } } },
    orderBy: { completedAt: 'desc' }, take: 600,
    select: { setNumber: true, reps: true, weightKg: true, sessionId: true, session: { select: { startedAt: true } }, workoutExercise: { select: { exerciseId: true } } },
  });
  const latest = new Map<string, { sessionId: string; date: Date; sets: Array<{ setNumber: number; reps: number | null; weightKg: number | null }> }>();
  for (const s of sets) {
    const ex = s.workoutExercise.exerciseId!;
    const cur = latest.get(ex);
    if (!cur) latest.set(ex, { sessionId: s.sessionId, date: s.session.startedAt, sets: [{ setNumber: s.setNumber, reps: s.reps, weightKg: s.weightKg }] });
    else if (cur.sessionId === s.sessionId) cur.sets.push({ setNumber: s.setNumber, reps: s.reps, weightKg: s.weightKg });
  }
  return wxs.flatMap((w) => {
    const p = w.exerciseId ? latest.get(w.exerciseId) : undefined;
    return p ? [{ workoutExerciseId: w.id, exerciseId: w.exerciseId, date: p.date.toISOString(), sets: p.sets.sort((a, b) => a.setNumber - b.setNumber) }] : [];
  });
}

async function toSessionDto(s: SessionRow): Promise<SessionDto> {
  return {
    id: s.id, workoutId: s.workoutId, workoutName: s.workout.name, status: s.status, startedAt: s.startedAt.toISOString(), completedAt: s.completedAt?.toISOString() ?? null, perceivedExertion: s.perceivedExertion,
    exercises: s.workout.exercises.map(toWx),
    sets: s.sets.map((x) => ({ id: x.id, workoutExerciseId: x.workoutExerciseId, setNumber: x.setNumber, targetReps: x.targetReps, reps: x.reps, weightKg: x.weightKg, rpe: x.rpe, skipped: x.skipped, completed: !!x.completedAt || x.skipped })),
    previous: await previousFor(s.clientId, s.id, s.workout.exercises),
  };
}

async function ownSession(req: Request, id: string) {
  const clientId = req.auth!.clientId;
  if (!clientId) throw forbidden('Only clients can perform workouts');
  const s = await prisma.workoutSession.findFirst({ where: { id, clientId }, include: sessionInclude });
  if (!s) throw notFound('Session not found');
  return s;
}

export async function startSession(req: Request, workoutId: string): Promise<SessionDto> {
  const clientId = req.auth!.clientId;
  if (!clientId) throw forbidden('Only clients can perform workouts');
  const w = await prisma.workout.findFirst({ where: { id: workoutId, clientId, isTemplate: false, status: { not: 'DRAFT' } } });
  if (!w) throw notFound('Workout not found');
  const open = await prisma.workoutSession.findFirst({ where: { workoutId, clientId, status: 'IN_PROGRESS' }, include: sessionInclude });
  if (open) return toSessionDto(open);
  if (w.status === 'COMPLETED') throw new AppError(409, 'ALREADY_COMPLETED', 'You already completed this workout');
  const created = await prisma.$transaction(async (tx) => {
    await tx.workout.update({ where: { id: workoutId }, data: { status: 'IN_PROGRESS' } });
    return tx.workoutSession.create({ data: { workoutId, clientId }, include: sessionInclude });
  });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'WORKOUT_STARTED', entityType: 'WorkoutSession', entityId: created.id });
  return toSessionDto(created);
}

export async function getSession(req: Request, id: string): Promise<SessionDto> {
  const a = req.auth!;
  const s = await prisma.workoutSession.findUnique({ where: { id }, include: sessionInclude });
  if (!s) throw notFound('Session not found');
  await assertCanAccessClient(req, s.clientId);
  void a;
  return toSessionDto(s);
}

export async function logSet(req: Request, input: SetLogInput): Promise<SessionDto> {
  const s = await ownSession(req, input.sessionId);
  if (s.status !== 'IN_PROGRESS') throw new AppError(409, 'SESSION_CLOSED', 'This session is already finished');
  const wx = s.workout.exercises.find((e) => e.id === input.workoutExerciseId);
  if (!wx) throw badRequest('That exercise is not part of this workout');
  if (input.setNumber > wx.sets + 5) throw badRequest('Set number is out of range');
  const done = !input.skipped;
  await prisma.workoutSet.upsert({
    where: { sessionId_workoutExerciseId_setNumber: { sessionId: s.id, workoutExerciseId: wx.id, setNumber: input.setNumber } },
    update: { reps: input.reps ?? null, weightKg: input.weightKg ?? null, rpe: input.rpe ?? null, skipped: input.skipped, restSecTaken: input.restSecTaken ?? null, completedAt: done ? new Date() : null },
    create: { sessionId: s.id, workoutExerciseId: wx.id, setNumber: input.setNumber, targetReps: parseInt(wx.reps, 10) || null, reps: input.reps ?? null, weightKg: input.weightKg ?? null, rpe: input.rpe ?? null, skipped: input.skipped, restSecTaken: input.restSecTaken ?? null, completedAt: done ? new Date() : null },
  });
  if (done) {
    const completed = await prisma.workoutSet.count({ where: { sessionId: s.id, workoutExerciseId: wx.id, skipped: false, completedAt: { not: null } } });
    if (completed === wx.sets) await logActivity({ actorUserId: req.auth!.userId, clientId: s.clientId, type: 'EXERCISE_COMPLETED', entityType: 'WorkoutSession', entityId: s.id, metadata: { exercise: wx.exercise?.name ?? wx.customName ?? null } });
  }
  return toSessionDto((await prisma.workoutSession.findUnique({ where: { id: s.id }, include: sessionInclude }))!);
}

export async function skipExercise(req: Request, sessionId: string, workoutExerciseId: string): Promise<SessionDto> {
  const s = await ownSession(req, sessionId);
  if (s.status !== 'IN_PROGRESS') throw new AppError(409, 'SESSION_CLOSED', 'This session is already finished');
  const wx = s.workout.exercises.find((e) => e.id === workoutExerciseId);
  if (!wx) throw badRequest('That exercise is not part of this workout');
  await prisma.$transaction(
    Array.from({ length: wx.sets }, (_, i) =>
      prisma.workoutSet.upsert({
        where: { sessionId_workoutExerciseId_setNumber: { sessionId, workoutExerciseId, setNumber: i + 1 } },
        update: { skipped: true, completedAt: null, reps: null, weightKg: null },
        create: { sessionId, workoutExerciseId, setNumber: i + 1, skipped: true },
      }),
    ),
  );
  await logActivity({ actorUserId: req.auth!.userId, clientId: s.clientId, type: 'EXERCISE_SKIPPED', entityType: 'WorkoutSession', entityId: sessionId, metadata: { exercise: wx.exercise?.name ?? wx.customName ?? null } });
  return toSessionDto((await prisma.workoutSession.findUnique({ where: { id: sessionId }, include: sessionInclude }))!);
}

export async function finishSession(req: Request, id: string, body: { perceivedExertion?: number; notes?: string }): Promise<SessionDto> {
  const s = await ownSession(req, id);
  if (s.status === 'COMPLETED') return toSessionDto(s);
  const done = await prisma.$transaction(async (tx) => {
    await tx.workout.update({ where: { id: s.workoutId }, data: { status: 'COMPLETED' } });
    return tx.workoutSession.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date(), perceivedExertion: body.perceivedExertion, notes: body.notes }, include: sessionInclude });
  });
  await logActivity({ actorUserId: req.auth!.userId, clientId: s.clientId, type: 'WORKOUT_COMPLETED', entityType: 'WorkoutSession', entityId: id });
  return toSessionDto(done);
}

export async function listSessions(req: Request, clientId: string | undefined): Promise<SessionSummary[]> {
  const id = req.auth!.role === 'CLIENT' ? req.auth!.clientId : clientId;
  if (!id) throw badRequest('Choose a client', { clientId: ['Required'] });
  await assertCanAccessClient(req, id);
  const rows = await prisma.workoutSession.findMany({
    where: { clientId: id }, orderBy: { startedAt: 'desc' }, take: 100,
    include: { workout: { select: { name: true } }, sets: { where: { skipped: false, completedAt: { not: null } }, select: { reps: true, weightKg: true } } },
  });
  return rows.map((r) => ({
    id: r.id, workoutName: r.workout.name, startedAt: r.startedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null, status: r.status,
    setsDone: r.sets.length, volumeKg: Math.round(r.sets.reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0)),
  }));
}
