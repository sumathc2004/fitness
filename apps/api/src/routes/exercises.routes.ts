import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { exerciseInputSchema } from '@gym/types';
import type { ExerciseInput } from '@gym/types';
import { AppError, notFound } from '../lib/errors';
import { storage } from '../lib/storage';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as ex from '../services/exercise.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });

export const exercisesRouter = Router();
exercisesRouter.use(authenticate);

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(['STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'PLYOMETRIC', 'CORE']).optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  muscle: z.string().trim().max(40).optional(),
  has3d: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
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

// 3D models (admin only)
exercisesRouter.get('/:id/3d', requirePermission('exercises:read'), async (req, res) => {
  res.json({ items: (await ex.getExercise(String(req.params.id))).assets });
});
exercisesRouter.post('/:id/3d', requireRole('SUPER_ADMIN'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) return next(new AppError(400, 'UPLOAD_ERROR', err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than the 60 MB limit' : err.message));
    next(err);
  });
}, async (req, res) => {
  if (!req.file) throw new AppError(400, 'NO_FILE', 'Attach a .glb file in the "file" field');
  const body = z.object({ credit: z.string().trim().max(200).optional(), animationClip: z.string().trim().max(80).optional() }).parse(req.body);
  res.status(201).json(await ex.addAsset(req, String(req.params.id), req.file, body));
});
exercisesRouter.delete('/:id/3d/:assetId', requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await ex.removeAsset(req, String(req.params.id), String(req.params.assetId)));
});

/** GET /api/assets/exercise3d/<file> — authenticated download of a stored model. */
export const assetsRouter = Router();
assetsRouter.get('/exercise3d/:file', authenticate, async (req, res) => {
  const key = `exercise3d/${String(req.params.file)}`;
  const known = await import('@gym/database').then(({ prisma }) => prisma.exercise3DAsset.count({ where: { storageKey: key, isActive: true } }));
  if (!known) throw notFound('Model not found');
  const file = storage.pathFor?.(key);
  if (!file) throw notFound();
  res.setHeader('Content-Type', 'model/gltf-binary');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file, (err) => { if (err && !res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Model not found' } }); });
});
