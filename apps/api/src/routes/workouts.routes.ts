import { Router } from 'express';
import { z } from 'zod';
import { assignWorkoutSchema, setLogSchema, workoutInputSchema } from '@gym/types';
import type { SetLogInput, WorkoutInput } from '@gym/types';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as w from '../services/workout.service';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ─────────────────────────────────────────── /api/workouts
export const workoutsRouter = Router();
workoutsRouter.use(authenticate);

const listQuery = z.object({
  clientId: z.string().optional(),
  template: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  from: date.optional(), to: date.optional(),
  status: z.enum(['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
});

workoutsRouter.get('/', async (req, res) => {
  const q = listQuery.parse(req.query);
  res.json({ items: await w.listWorkouts(req, q) });
});
workoutsRouter.get('/today', requirePermission('workouts:read-own'), async (req, res) => {
  res.json({ items: await w.todaysWorkouts(req) });
});
workoutsRouter.post('/', requirePermission('workouts:manage'), validate(workoutInputSchema), async (req, res) => {
  res.status(201).json(await w.createWorkout(req, req.body as WorkoutInput));
});
workoutsRouter.get('/:id', async (req, res) => {
  res.json(await w.getWorkout(req, String(req.params.id)));
});
workoutsRouter.put('/:id', requirePermission('workouts:manage'), validate(workoutInputSchema), async (req, res) => {
  res.json(await w.updateWorkout(req, String(req.params.id), req.body as WorkoutInput));
});
workoutsRouter.delete('/:id', requirePermission('workouts:manage'), async (req, res) => {
  await w.deleteWorkout(req, String(req.params.id));
  res.json({ ok: true });
});
workoutsRouter.post('/:id/duplicate', requirePermission('workouts:manage'), async (req, res) => {
  res.status(201).json(await w.duplicateWorkout(req, String(req.params.id)));
});
workoutsRouter.post('/:id/assign', requirePermission('workouts:manage'), validate(assignWorkoutSchema), async (req, res) => {
  const { clientIds, scheduledDate } = req.body as { clientIds: string[]; scheduledDate: string };
  res.status(201).json({ items: await w.assignWorkout(req, String(req.params.id), clientIds, scheduledDate) });
});

// ─────────────────────────────────────────── /api/workout-sessions
export const sessionsRouter = Router();
sessionsRouter.use(authenticate);
sessionsRouter.get('/', async (req, res) => {
  res.json({ items: await w.listSessions(req, typeof req.query.clientId === 'string' ? req.query.clientId : undefined) });
});
sessionsRouter.post('/', requirePermission('workouts:perform'), validate(z.object({ workoutId: z.string().min(1) })), async (req, res) => {
  res.status(201).json(await w.startSession(req, (req.body as { workoutId: string }).workoutId));
});
sessionsRouter.get('/:id', async (req, res) => {
  res.json(await w.getSession(req, String(req.params.id)));
});
sessionsRouter.post('/:id/skip-exercise', requirePermission('workouts:perform'), validate(z.object({ workoutExerciseId: z.string().min(1) })), async (req, res) => {
  res.json(await w.skipExercise(req, String(req.params.id), (req.body as { workoutExerciseId: string }).workoutExerciseId));
});
sessionsRouter.post('/:id/finish', requirePermission('workouts:perform'), validate(z.object({ perceivedExertion: z.coerce.number().int().min(1).max(10).optional(), notes: z.string().trim().max(1000).optional() })), async (req, res) => {
  res.json(await w.finishSession(req, String(req.params.id), req.body as { perceivedExertion?: number; notes?: string }));
});

// ─────────────────────────────────────────── /api/workout-sets
export const setsRouter = Router();
setsRouter.use(authenticate);
setsRouter.put('/', requirePermission('workouts:perform'), validate(setLogSchema), async (req, res) => {
  res.json(await w.logSet(req, req.body as SetLogInput));
});
