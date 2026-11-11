import request from 'supertest';
import { ROLE_NAMES, ROLE_PERMISSIONS, type RoleName } from '@gym/config';
import { prisma } from '@gym/database';
import { createApp } from '../src/app';
import { hashPassword } from '../src/lib/crypto';

export const app = createApp();
export const PASSWORD = 'Str0ng!Passw0rd';
let counter = 0;

/** Wipes every table (one TRUNCATE … CASCADE) and re-creates the three roles. Call in beforeAll of files needing a clean slate. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  for (const name of ROLE_NAMES) await prisma.role.create({ data: { name, permissions: [...ROLE_PERMISSIONS[name]] } });
}

export async function createUser(role: RoleName, opts: { email?: string; username?: string; password?: string; status?: 'ACTIVE' | 'SUSPENDED'; firstName?: string; lastName?: string; joinedDaysAgo?: number } = {}) {
  counter += 1;
  const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const email = (opts.email ?? `${role.toLowerCase()}${counter}.${Date.now()}@test.local`).toLowerCase();
  const joinedAt = new Date(Date.now() - (opts.joinedDaysAgo ?? 60) * 86_400_000);
  const user = await prisma.user.create({
    data: {
      email, username: opts.username, passwordHash: await hashPassword(opts.password ?? PASSWORD), roleId: roleRow.id, status: opts.status ?? 'ACTIVE',
      firstName: opts.firstName ?? role.slice(0, 1) + role.slice(1).toLowerCase(), lastName: opts.lastName ?? `User${counter}`,
      ...(role === 'TRAINER' ? { trainer: { create: {} } } : {}),
      ...(role === 'CLIENT' ? { client: { create: { joinedAt, createdAt: joinedAt } } } : {}),
    },
    include: { trainer: true, client: true },
  });
  return { user, email, password: opts.password ?? PASSWORD, trainerId: user.trainer?.id ?? null, clientId: user.client?.id ?? null };
}

export async function assign(trainerId: string, clientId: string) {
  await prisma.trainerClient.create({ data: { trainerId, clientId } });
}

/** Supertest agent that keeps cookies, already logged in. */
export async function loggedInAgent(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ identifier: email, password });
  if (res.status !== 200) throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  return agent;
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const hit = raw.find((c) => c.startsWith(`${name}=`));
  return hit?.split(';')[0]?.slice(name.length + 1);
}
