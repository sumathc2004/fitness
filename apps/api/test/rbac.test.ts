import request from 'supertest';
import type { Request } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, assign, createUser, loggedInAgent, resetDb } from './helpers';
import { assertCanAccessClient, visibleClientIds } from '../src/services/access.service';
import { AppError } from '../src/lib/errors';

let admin: Awaited<ReturnType<typeof createUser>>;
let trainerA: Awaited<ReturnType<typeof createUser>>;
let trainerB: Awaited<ReturnType<typeof createUser>>;
let clientA: Awaited<ReturnType<typeof createUser>>;
let clientB: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  await resetDb();
  admin = await createUser('SUPER_ADMIN');
  trainerA = await createUser('TRAINER');
  trainerB = await createUser('TRAINER');
  clientA = await createUser('CLIENT');
  clientB = await createUser('CLIENT');
  await assign(trainerA.trainerId!, clientA.clientId!);
  await assign(trainerB.trainerId!, clientB.clientId!);
});

const DASHBOARDS = [
  { path: '/api/admin/dashboard', role: 'SUPER_ADMIN' },
  { path: '/api/trainers/dashboard', role: 'TRAINER' },
  { path: '/api/clients/dashboard', role: 'CLIENT' },
] as const;

describe('dashboard endpoints are role-gated on the server', () => {
  it('require authentication', async () => {
    for (const d of DASHBOARDS) expect((await request(app).get(d.path)).status, d.path).toBe(401);
  });

  it('allow only the matching role (every other role gets 403)', async () => {
    const who = { SUPER_ADMIN: admin, TRAINER: trainerA, CLIENT: clientA };
    for (const caller of Object.keys(who) as Array<keyof typeof who>) {
      const agent = await loggedInAgent(who[caller].email);
      for (const d of DASHBOARDS) {
        const res = await agent.get(d.path);
        expect(res.status, `${caller} → ${d.path}`).toBe(caller === d.role ? 200 : 403);
      }
    }
  });
});

describe('ownership rules (used by every client-scoped endpoint from Phase 2)', () => {
  const reqFor = (auth: Express.AuthContext) => ({ auth }) as unknown as Request;
  const ctx = (u: Awaited<ReturnType<typeof createUser>>, role: Express.AuthContext['role']) => reqFor({ userId: u.user.id, role, trainerId: u.trainerId, clientId: u.clientId });

  it('super admin can open any client; unknown ids are 404', async () => {
    await expect(assertCanAccessClient(ctx(admin, 'SUPER_ADMIN'), clientA.clientId!)).resolves.toBeUndefined();
    await expect(assertCanAccessClient(ctx(admin, 'SUPER_ADMIN'), 'does-not-exist')).rejects.toMatchObject({ status: 404 });
  });

  it('a trainer can open only their own clients — others look like they do not exist', async () => {
    await expect(assertCanAccessClient(ctx(trainerA, 'TRAINER'), clientA.clientId!)).resolves.toBeUndefined();
    const err = await assertCanAccessClient(ctx(trainerA, 'TRAINER'), clientB.clientId!).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(404);
  });

  it('a client can open only themselves', async () => {
    await expect(assertCanAccessClient(ctx(clientA, 'CLIENT'), clientA.clientId!)).resolves.toBeUndefined();
    await expect(assertCanAccessClient(ctx(clientA, 'CLIENT'), clientB.clientId!)).rejects.toMatchObject({ status: 403 });
  });

  it('visibleClientIds scopes lists by role', async () => {
    expect(await visibleClientIds(ctx(admin, 'SUPER_ADMIN'))).toBeNull();
    expect(await visibleClientIds(ctx(trainerA, 'TRAINER'))).toEqual([clientA.clientId]);
    expect(await visibleClientIds(ctx(clientB, 'CLIENT'))).toEqual([clientB.clientId]);
  });

  it('ended assignments no longer grant access', async () => {
    const t = await createUser('TRAINER');
    const c = await createUser('CLIENT');
    await assign(t.trainerId!, c.clientId!);
    await import('@gym/database').then(({ prisma }) => prisma.trainerClient.updateMany({ where: { trainerId: t.trainerId!, clientId: c.clientId! }, data: { endedAt: new Date() } }));
    await expect(assertCanAccessClient(ctx(t, 'TRAINER'), c.clientId!)).rejects.toMatchObject({ status: 404 });
  });
});

describe('audit log endpoint', () => {
  it('is Super Admin only', async () => {
    expect((await request(app).get('/api/admin/audit-logs')).status).toBe(401);
    expect((await (await loggedInAgent(trainerA.email)).get('/api/admin/audit-logs')).status).toBe(403);
    expect((await (await loggedInAgent(clientA.email)).get('/api/admin/audit-logs')).status).toBe(403);
  });

  it('returns newest-first pages with actor names, and supports filtering + validation', async () => {
    const agent = await loggedInAgent(admin.email);
    const res = await agent.get('/api/admin/audit-logs?page=1&pageSize=5');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThan(0);
    const times = res.body.items.map((i: { at: string }) => new Date(i.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const logins = await agent.get('/api/admin/audit-logs?action=LOGIN');
    expect(logins.body.items.every((i: { action: string }) => i.action === 'LOGIN')).toBe(true);
    expect((await agent.get('/api/admin/audit-logs?pageSize=9999')).status).toBe(400);
  });
});
