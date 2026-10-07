import type { Request } from 'express';
import { Prisma, prisma } from '@gym/database';
import type { ClientDetail, ClientListItem, CreateClientInput, CreateTrainerInput, Paginated, TrainerListItem, UpdateClientInput, UpdateTrainerInput } from '@gym/types';
import { hashPassword, randomToken } from '../lib/crypto';
import { AppError, conflict, forbidden, notFound } from '../lib/errors';
import { skipTake } from '../lib/pagination';
import { assertCanAccessClient, visibleClientIds } from './access.service';
import { audit } from './audit.service';
import { assessClients } from './attention.service';
import { notify } from './notification.service';

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const dateStr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Turns a unique-constraint violation into a friendly 409. */
function uniqueConflict(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = String((err.meta as { target?: unknown })?.target ?? '');
    throw conflict(target.includes('username') ? 'That username is already taken for this role' : 'That email is already in use');
  }
  throw err;
}

async function assertTrainerCapacity(trainerId: string) {
  const t = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { maxClients: true, user: { select: { status: true, deletedAt: true } } } });
  if (!t || t.user.deletedAt) throw notFound('Trainer not found');
  if (t.user.status !== 'ACTIVE') throw conflict('That trainer account is suspended');
  if (t.maxClients) {
    const n = await prisma.trainerClient.count({ where: { trainerId, endedAt: null } });
    if (n >= t.maxClients) throw conflict(`That trainer is at capacity (${t.maxClients} clients)`);
  }
}

// ───────────────────────────────────────────────────────── trainers (admin)
const trainerSelect = {
  id: true, bio: true, specialties: true, maxClients: true,
  user: { select: { id: true, email: true, username: true, firstName: true, lastName: true, phone: true, status: true } },
  clients: { where: { endedAt: null }, select: { clientId: true } },
} satisfies Prisma.TrainerSelect;

const toTrainerItem = (t: Prisma.TrainerGetPayload<{ select: typeof trainerSelect }>): TrainerListItem => ({
  id: t.id, userId: t.user.id, name: fullName(t.user), email: t.user.email, username: t.user.username, phone: t.user.phone, status: t.user.status,
  clients: t.clients.length, maxClients: t.maxClients, specialties: Array.isArray(t.specialties) ? (t.specialties as string[]) : [], bio: t.bio,
});

export async function listTrainers(q?: string): Promise<TrainerListItem[]> {
  const rows = await prisma.trainer.findMany({
    where: { user: { deletedAt: null, ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } : {}) } },
    select: trainerSelect, orderBy: { user: { firstName: 'asc' } },
  });
  return rows.map(toTrainerItem);
}

export async function getTrainer(id: string): Promise<TrainerListItem> {
  const t = await prisma.trainer.findFirst({ where: { id, user: { deletedAt: null } }, select: trainerSelect });
  if (!t) throw notFound('Trainer not found');
  return toTrainerItem(t);
}

export async function createTrainer(req: Request, input: CreateTrainerInput): Promise<TrainerListItem> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'TRAINER' } });
  try {
    const created = await prisma.trainer.create({
      data: {
        bio: input.bio, specialties: input.specialties, maxClients: input.maxClients, hiredAt: new Date(),
        user: { create: { email: input.email, username: input.username, passwordHash: await hashPassword(input.password), firstName: input.firstName, lastName: input.lastName, phone: input.phone, roleId: role.id } },
      },
      select: trainerSelect,
    });
    await audit(req, { action: 'TRAINER_CREATED', entityType: 'Trainer', entityId: created.id, after: { email: input.email } });
    return toTrainerItem(created);
  } catch (e) { return uniqueConflict(e); }
}

export async function updateTrainer(req: Request, id: string, input: UpdateTrainerInput): Promise<TrainerListItem> {
  const existing = await prisma.trainer.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) throw notFound('Trainer not found');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: { email: input.email, username: input.username, firstName: input.firstName, lastName: input.lastName, phone: input.phone, status: input.status },
      });
      await tx.trainer.update({ where: { id }, data: { bio: input.bio, specialties: input.specialties, maxClients: input.maxClients } });
      if (input.status === 'SUSPENDED') await tx.refreshToken.updateMany({ where: { userId: existing.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  } catch (e) { return uniqueConflict(e); }
  await audit(req, { action: input.status ? `TRAINER_${input.status}` : 'TRAINER_UPDATED', entityType: 'Trainer', entityId: id });
  return getTrainer(id);
}

// ───────────────────────────────────────────────────────── clients
export async function listClients(req: Request, q: { q?: string; status?: 'ACTIVE' | 'PAUSED' | 'INACTIVE'; trainerId?: string; page: number; pageSize: number }): Promise<Paginated<ClientListItem>> {
  const visible = await visibleClientIds(req);
  const search = q.q?.trim();
  const where: Prisma.ClientWhereInput = {
    user: { deletedAt: null, ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }] } : {}) },
    ...(visible ? { id: { in: visible } } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.trainerId ? { trainers: { some: { trainerId: q.trainerId, endedAt: null } } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where, ...skipTake(q), orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        bodyProfile: { select: { goal: true } },
        trainers: { where: { endedAt: null }, take: 1, select: { trainerId: true, trainer: { select: { user: { select: { firstName: true, lastName: true } } } } } },
        measurements: { where: { weightKg: { not: null } }, orderBy: { measuredAt: 'desc' }, take: 1, select: { weightKg: true } },
        subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endDate: 'desc' }, take: 1, select: { endDate: true } },
      },
    }),
  ]);
  const attention = new Map((await assessClients(rows.map((r) => r.id))).map((a) => [a.clientId, a]));
  return {
    total, page: q.page, pageSize: q.pageSize,
    items: rows.map((c) => {
      const a = attention.get(c.id);
      const t = c.trainers[0];
      return {
        id: c.id, userId: c.userId, name: fullName(c.user), email: c.user.email, phone: c.user.phone, status: c.status,
        goal: c.bodyProfile?.goal ?? null, trainerId: t?.trainerId ?? null, trainerName: t ? fullName(t.trainer.user) : null,
        joinedAt: c.joinedAt.toISOString(), level: a?.level ?? 'GOOD', reasons: a?.reasons ?? [], lastActivityAt: a?.lastActivityAt ?? null,
        weightKg: c.measurements[0]?.weightKg ?? null, membershipEnds: dateStr(c.subscriptions[0]?.endDate),
      };
    }),
  };
}

const ageOf = (dob: Date | null) => (dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000)) : null);

export async function getClientDetail(req: Request, id: string): Promise<ClientDetail> {
  await assertCanAccessClient(req, id);
  const c = await prisma.client.findFirst({
    where: { id, user: { deletedAt: null } },
    include: {
      user: true, bodyProfile: true,
      trainers: { where: { endedAt: null }, take: 1, select: { trainerId: true, notes: true, trainer: { select: { user: { select: { firstName: true, lastName: true } } } } } },
      subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endDate: 'desc' }, take: 1, include: { membership: { select: { name: true } } } },
      nutritionTargets: { where: { isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
    },
  });
  if (!c) throw notFound('Client not found');
  const [att] = await assessClients([id]);
  const link = c.trainers[0];
  const sub = c.subscriptions[0];
  const tg = c.nutritionTargets[0];
  return {
    id: c.id, userId: c.userId, firstName: c.user.firstName, lastName: c.user.lastName, email: c.user.email, username: c.user.username, phone: c.user.phone,
    status: c.status, accountStatus: c.user.status, joinedAt: c.joinedAt.toISOString(), dateOfBirth: dateStr(c.dateOfBirth), ageYears: ageOf(c.dateOfBirth),
    emergencyContact: c.emergencyContact, qrCode: c.qrCode, trainerId: link?.trainerId ?? null, trainerName: link ? fullName(link.trainer.user) : null,
    // trainer notes are private to staff
    notes: req.auth!.role === 'CLIENT' ? null : link?.notes ?? null,
    profile: c.bodyProfile ? { sex: c.bodyProfile.sex, heightCm: c.bodyProfile.heightCm, activityLevel: c.bodyProfile.activityLevel, trainingExperience: c.bodyProfile.trainingExperience, goal: c.bodyProfile.goal, injuries: c.bodyProfile.injuries } : null,
    attention: { level: att?.level ?? 'GOOD', reasons: att?.reasons ?? [] },
    membership: sub ? { name: sub.membership.name, endDate: dateStr(sub.endDate)!, status: sub.status } : null,
    target: tg ? { calories: tg.calories, proteinG: tg.proteinG, carbsG: tg.carbsG, fatG: tg.fatG, fiberG: tg.fiberG, waterMl: tg.waterMl } : null,
  };
}

export async function createClient(req: Request, input: CreateClientInput): Promise<ClientDetail> {
  const auth = req.auth!;
  const trainerId = auth.role === 'TRAINER' ? auth.trainerId : input.trainerId ?? null;
  if (auth.role === 'TRAINER' && !trainerId) throw forbidden();
  if (trainerId) await assertTrainerCapacity(trainerId);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'CLIENT' } });
  try {
    const client = await prisma.client.create({
      data: {
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined,
        emergencyContact: input.emergencyContact, qrCode: `GYM-${randomToken(6).replace(/[^A-Za-z0-9]/g, 'X').toUpperCase()}`,
        user: { create: { email: input.email, username: input.username, passwordHash: await hashPassword(input.password), firstName: input.firstName, lastName: input.lastName, phone: input.phone, roleId: role.id } },
        bodyProfile: { create: { sex: input.sex, heightCm: input.heightCm, goal: input.goal, activityLevel: input.activityLevel, trainingExperience: input.trainingExperience, injuries: input.injuries } },
        ...(trainerId ? { trainers: { create: { trainerId } } } : {}),
        ...(input.weightKg ? { measurements: { create: { weightKg: input.weightKg, recordedBy: auth.userId } } } : {}),
      },
      select: { id: true, userId: true },
    });
    await audit(req, { action: 'CLIENT_CREATED', entityType: 'Client', entityId: client.id, after: { email: input.email, trainerId } });
    if (trainerId) {
      const t = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { userId: true } });
      if (t && t.userId !== auth.userId) await notify({ userId: t.userId, type: 'SYSTEM', title: 'New client assigned', body: `${input.firstName} ${input.lastName} was added to your clients.` });
    }
    return getClientDetail(req, client.id);
  } catch (e) { return uniqueConflict(e); }
}

export async function updateClient(req: Request, id: string, input: UpdateClientInput): Promise<ClientDetail> {
  await assertCanAccessClient(req, id);
  const c = await prisma.client.findUnique({ where: { id }, select: { userId: true } });
  if (!c) throw notFound('Client not found');
  const profileFields = { sex: input.sex, heightCm: input.heightCm, goal: input.goal, activityLevel: input.activityLevel, trainingExperience: input.trainingExperience, injuries: input.injuries };
  const hasProfile = Object.values(profileFields).some((v) => v !== undefined);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: c.userId }, data: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, username: input.username } });
      await tx.client.update({ where: { id }, data: { status: input.status, emergencyContact: input.emergencyContact, dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined } });
      if (hasProfile) {
        await tx.bodyProfile.upsert({
          where: { clientId: id }, update: profileFields,
          create: { clientId: id, sex: input.sex ?? 'MALE', heightCm: input.heightCm ?? 170, goal: input.goal, activityLevel: input.activityLevel, trainingExperience: input.trainingExperience, injuries: input.injuries },
        });
      }
    });
  } catch (e) { return uniqueConflict(e); }
  await audit(req, { action: 'CLIENT_UPDATED', entityType: 'Client', entityId: id, after: input as Prisma.InputJsonValue });
  return getClientDetail(req, id);
}

export async function reassignTrainer(req: Request, clientId: string, trainerId: string): Promise<ClientDetail> {
  await assertTrainerCapacity(trainerId);
  const current = await prisma.trainerClient.findFirst({ where: { clientId, endedAt: null } });
  if (current?.trainerId === trainerId) return getClientDetail(req, clientId);
  await prisma.$transaction(async (tx) => {
    await tx.trainerClient.updateMany({ where: { clientId, endedAt: null }, data: { endedAt: new Date() } });
    await tx.trainerClient.upsert({
      where: { trainerId_clientId: { trainerId, clientId } }, update: { endedAt: null, assignedAt: new Date(), notes: current?.notes ?? null },
      create: { trainerId, clientId, notes: current?.notes ?? null },
    });
  });
  await audit(req, { action: 'CLIENT_REASSIGNED', entityType: 'Client', entityId: clientId, before: { trainerId: current?.trainerId ?? null }, after: { trainerId } });
  const t = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { userId: true } });
  if (t) await notify({ userId: t.userId, type: 'SYSTEM', title: 'New client assigned', body: 'A client was assigned to you.', data: { clientId } });
  return getClientDetail(req, clientId);
}

export async function setClientNotes(req: Request, clientId: string, notes: string): Promise<void> {
  await assertCanAccessClient(req, clientId);
  const link = await prisma.trainerClient.findFirst({ where: { clientId, endedAt: null, ...(req.auth!.role === 'TRAINER' ? { trainerId: req.auth!.trainerId! } : {}) } });
  if (!link) throw new AppError(409, 'NO_TRAINER', 'Assign a trainer to this client before adding notes');
  await prisma.trainerClient.update({ where: { id: link.id }, data: { notes } });
}

/** Admin: any user. Trainer: only their own clients. Revokes every session of that user. */
export async function setUserPassword(req: Request, userId: string, password: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, client: { select: { id: true } } } });
  if (!target) throw notFound('User not found');
  if (req.auth!.role === 'TRAINER') {
    if (!target.client) throw forbidden();
    await assertCanAccessClient(req, target.client.id);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(req, { action: 'PASSWORD_SET_BY_STAFF', entityType: 'User', entityId: userId });
}
