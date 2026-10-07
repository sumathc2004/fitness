import { Router } from 'express';
import { z } from 'zod';
import { adminSetPasswordSchema, createClientSchema, createTrainerSchema, updateClientSchema, updateTrainerSchema } from '@gym/types';
import type { CreateClientInput, CreateTrainerInput, UpdateClientInput, UpdateTrainerInput } from '@gym/types';
import { forbidden } from '../lib/errors';
import { pageQuery } from '../lib/pagination';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { assertCanAccessClient } from '../services/access.service';
import { clientDashboard, trainerDashboard } from '../services/dashboard.service';
import * as people from '../services/people.service';

// ─────────────────────────────────────────── /api/trainers
export const trainersRouter = Router();
trainersRouter.use(authenticate);

trainersRouter.get('/dashboard', requirePermission('dashboard:trainer'), async (req, res) => {
  if (!req.auth!.trainerId) throw forbidden('No trainer profile is linked to this account');
  res.json(await trainerDashboard(req.auth!.trainerId));
});
// Staff can see the trainer list (a trainer needs it for nothing sensitive; admins use it to assign clients).
trainersRouter.get('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json({ items: await people.listTrainers(typeof req.query.q === 'string' ? req.query.q : undefined) });
});
trainersRouter.post('/', requirePermission('trainers:manage'), validate(createTrainerSchema), async (req, res) => {
  res.status(201).json(await people.createTrainer(req, req.body as CreateTrainerInput));
});
trainersRouter.get('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await people.getTrainer(String(req.params.id)));
});
trainersRouter.patch('/:id', requirePermission('trainers:manage'), validate(updateTrainerSchema), async (req, res) => {
  res.json(await people.updateTrainer(req, String(req.params.id), req.body as UpdateTrainerInput));
});

// ─────────────────────────────────────────── /api/clients
export const clientsRouter = Router();
clientsRouter.use(authenticate);

clientsRouter.get('/dashboard', requirePermission('dashboard:client'), async (req, res) => {
  if (!req.auth!.clientId) throw forbidden('No client profile is linked to this account');
  res.json(await clientDashboard(req.auth!.clientId));
});

const listQuery = pageQuery.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).optional(),
  trainerId: z.string().optional(),
});

clientsRouter.get('/', requireRole('SUPER_ADMIN', 'TRAINER'), async (req, res) => {
  res.json(await people.listClients(req, listQuery.parse(req.query)));
});
clientsRouter.post('/', requirePermission('clients:manage'), validate(createClientSchema), async (req, res) => {
  res.status(201).json(await people.createClient(req, req.body as CreateClientInput));
});
clientsRouter.get('/:id', async (req, res) => {
  res.json(await people.getClientDetail(req, String(req.params.id)));
});
clientsRouter.patch('/:id', requireRole('SUPER_ADMIN', 'TRAINER'), validate(updateClientSchema), async (req, res) => {
  res.json(await people.updateClient(req, String(req.params.id), req.body as UpdateClientInput));
});
clientsRouter.put('/:id/trainer', requireRole('SUPER_ADMIN'), validate(z.object({ trainerId: z.string().min(1) })), async (req, res) => {
  res.json(await people.reassignTrainer(req, String(req.params.id), (req.body as { trainerId: string }).trainerId));
});
clientsRouter.put('/:id/notes', requireRole('SUPER_ADMIN', 'TRAINER'), validate(z.object({ notes: z.string().max(4000) })), async (req, res) => {
  await people.setClientNotes(req, String(req.params.id), (req.body as { notes: string }).notes);
  res.json({ ok: true });
});
clientsRouter.post('/:id/check-access', async (req, res) => {
  await assertCanAccessClient(req, String(req.params.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────── staff password reset (mounted on /api/users)
export const staffPasswordRouter = Router();
staffPasswordRouter.post('/:id/password', authenticate, requireRole('SUPER_ADMIN', 'TRAINER'), validate(adminSetPasswordSchema), async (req, res) => {
  await people.setUserPassword(req, String(req.params.id), (req.body as { password: string }).password);
  res.json({ ok: true });
});
