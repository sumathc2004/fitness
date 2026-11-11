import { Router } from 'express';
import { z } from 'zod';
import { exerciseInputSchema } from '@gym/types';
import type { ExerciseInput } from '@gym/types';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as ex from '../services/exercise.service';

export const exercisesRouter = Router();
exercisesRouter.use(authenticate);

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(['STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'PLYOMETRIC', 'CORE']).optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  muscle: z.string().trim().max(40).optional(),
  includeInactive: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

exercisesRouter.get('/', requirePermission('exercises:read'), async (req, res) => {
  const q = listQuery.parse(req.query);
  // only staff may see archived exercises
  const includeInactive = q.includeInactive && req.auth!.role !== 'CLIENT';
  res.json({ items: await ex.listExercises({ ...q, includeInactive }) });
});
exercisesRouter.get('/:id', requirePermission('exercises:read'), async (req, res) => {
  res.json(await ex.getExercise(String(req.params.id)));
});
exercisesRouter.post('/', requirePermission('exercises:manage'), validate(exerciseInputSchema), async (req, res) => {
  res.status(201).json(await ex.createExercise(req, req.body as ExerciseInput));
});
exercisesRouter.put('/:id', requirePermission('exercises:manage'), validate(exerciseInputSchema), async (req, res) => {
  res.json(await ex.updateExercise(req, String(req.params.id), req.body as ExerciseInput));
});
exercisesRouter.post('/:id/archive', requirePermission('exercises:manage'), async (req, res) => {
  await ex.archiveExercise(req, String(req.params.id), false);
  res.json({ ok: true });
});
exercisesRouter.post('/:id/restore', requirePermission('exercises:manage'), async (req, res) => {
  await ex.archiveExercise(req, String(req.params.id), true);
  res.json({ ok: true });
});
